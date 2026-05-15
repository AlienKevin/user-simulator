"""SFT training: Qwen3-8B with LoRA on marcus-sa user simulator data.

Approach: standard SFT, loss masked on assistant turns only, using TRL's
SFTTrainer with completions_only via the assistant_loss feature. We use
peft LoRA r=64 on all linear layers + embed_tokens + lm_head. LR=2e-4 cosine,
3 epochs, effective batch 32 (micro=2, grad_accum=16), seq 4096, bf16.

Saves merged-into-fp16 weights to /vol/ckpt/<run_name>/ for vLLM serving.
"""
import json
import os
import time
from pathlib import Path

import modal

from common import app, train_image, volume, VOL_MOUNT, DATA_DIR, CKPT_DIR


@app.function(
    image=train_image,
    volumes={VOL_MOUNT: volume},
    secrets=[modal.Secret.from_name("huggingface")],
    gpu="A100-80GB",
    timeout=60 * 60 * 6,
    cpu=8,
    memory=64 * 1024,
)
def train(
    user_id: str = "marcus-sa",
    # Qwen2.5-7B-Instruct: Apache-2.0, 32K context, no <think> blocks (simpler
    # for JSON-only output than Qwen3), well-supported by vLLM. Qwen3-8B is
    # newer/better but its default thinking-mode complicates serving.
    base_model: str = "Qwen/Qwen2.5-7B-Instruct",
    run_name: str = "qwen25-7b-marcus-sa-v1",
    # 1 epoch keeps training under ~1 hour on A100-80GB at seq 8192. With
    # 1665 examples / 16 grad-accum that's ~104 optimizer steps — enough for
    # a LoRA on this focused dataset given LR=2e-4.
    epochs: float = 1.0,
    lr: float = 2e-4,
    seq_len: int = 8192,
    micro_batch: int = 1,
    grad_accum: int = 16,
    lora_r: int = 64,
    lora_alpha: int = 32,
    warmup_ratio: float = 0.03,
    save_steps: int = 0,  # 0 = save only at end
):
    import torch
    from datasets import load_dataset, Dataset
    from transformers import (
        AutoTokenizer,
        AutoModelForCausalLM,
        TrainingArguments,
        DataCollatorForLanguageModeling,
    )
    from peft import LoraConfig, get_peft_model, TaskType, PeftModel
    from trl import SFTTrainer, SFTConfig

    print(f"[train] torch={torch.__version__} | cuda_avail={torch.cuda.is_available()}")
    print(f"[train] gpu={torch.cuda.get_device_name(0) if torch.cuda.is_available() else 'cpu'}")

    out_dir = Path(CKPT_DIR) / run_name
    out_dir.mkdir(parents=True, exist_ok=True)
    log_dir = out_dir / "logs"
    log_dir.mkdir(parents=True, exist_ok=True)

    # --- data ---
    data_dir = Path(DATA_DIR) / user_id
    train_path = str(data_dir / "train.jsonl")
    val_path = str(data_dir / "val.jsonl")
    print(f"[train] loading data: {train_path}")
    train_ds = load_dataset("json", data_files=train_path, split="train")
    val_ds = load_dataset("json", data_files=val_path, split="train")
    print(f"[train] train={len(train_ds)} val={len(val_ds)}")

    # --- tokenizer / model ---
    print(f"[train] loading tokenizer + model: {base_model}")
    tok = AutoTokenizer.from_pretrained(base_model, token=os.environ["HF_TOKEN"])
    if tok.pad_token is None:
        tok.pad_token = tok.eos_token

    # Note: TRL 0.12.1 doesn't support assistant_only_loss. We train with the
    # default Qwen2.5 chat template and full-sequence loss. Loss on user/system
    # tokens is suboptimal but still trains the model to emit JSON at the right
    # spot. Upgrading TRL would let us mask user-tokens, but adds complexity.

    model = AutoModelForCausalLM.from_pretrained(
        base_model,
        torch_dtype=torch.bfloat16,
        attn_implementation="sdpa",
        token=os.environ["HF_TOKEN"],
    )
    model.config.use_cache = False
    model.gradient_checkpointing_enable()
    model.enable_input_require_grads()

    # --- LoRA ---
    target_modules = [
        "q_proj", "k_proj", "v_proj", "o_proj",
        "gate_proj", "up_proj", "down_proj",
    ]
    lora_cfg = LoraConfig(
        r=lora_r,
        lora_alpha=lora_alpha,
        lora_dropout=0.05,
        bias="none",
        task_type=TaskType.CAUSAL_LM,
        target_modules=target_modules,
    )
    model = get_peft_model(model, lora_cfg)
    model.print_trainable_parameters()

    # --- SFT config ---
    sft_cfg = SFTConfig(
        output_dir=str(out_dir / "adapter"),
        run_name=run_name,
        num_train_epochs=epochs,
        per_device_train_batch_size=micro_batch,
        per_device_eval_batch_size=1,
        gradient_accumulation_steps=grad_accum,
        learning_rate=lr,
        lr_scheduler_type="cosine",
        warmup_ratio=warmup_ratio,
        max_seq_length=seq_len,
        bf16=True,
        logging_steps=5,
        eval_strategy="steps",
        eval_steps=50,
        save_strategy="epoch" if save_steps == 0 else "steps",
        save_steps=save_steps if save_steps > 0 else None,
        save_total_limit=2,
        report_to=["tensorboard"],
        logging_dir=str(log_dir),
        gradient_checkpointing=True,
        gradient_checkpointing_kwargs={"use_reentrant": False},
        dataset_num_proc=4,
        dataloader_num_workers=2,
        packing=False,
        remove_unused_columns=True,
        max_grad_norm=1.0,
        weight_decay=0.0,
        optim="adamw_torch",
        seed=42,
    )

    # TRL 0.12 doesn't auto-detect the messages format → flatten with the
    # tokenizer's chat template into a single "text" field up front.
    def to_text(examples):
        texts = []
        for msgs in examples["messages"]:
            text = tok.apply_chat_template(
                msgs, tokenize=False, add_generation_prompt=False
            )
            texts.append(text)
        return {"text": texts}

    train_ds = train_ds.map(
        to_text,
        batched=True,
        remove_columns=[c for c in train_ds.column_names if c != "text"],
        num_proc=4,
    )
    val_ds = val_ds.map(
        to_text,
        batched=True,
        remove_columns=[c for c in val_ds.column_names if c != "text"],
        num_proc=4,
    )
    print(f"[train] formatted to text. example length (chars): {len(train_ds[0]['text'])}")

    trainer = SFTTrainer(
        model=model,
        args=sft_cfg,
        train_dataset=train_ds,
        eval_dataset=val_ds,
        processing_class=tok,
    )

    t0 = time.time()
    trainer.train()
    dt = time.time() - t0
    print(f"[train] training done in {dt/60:.1f} min")

    # Save adapter
    adapter_dir = out_dir / "adapter"
    trainer.save_model(str(adapter_dir))
    tok.save_pretrained(str(adapter_dir))
    print(f"[train] adapter saved to {adapter_dir}")

    # Merge LoRA into base for vLLM (vLLM 0.6.4 supports LoRA adapters, but
    # merging gives the simplest serving path).
    print("[train] merging LoRA into base model for serving...")
    del model
    del trainer
    torch.cuda.empty_cache()

    base = AutoModelForCausalLM.from_pretrained(
        base_model,
        torch_dtype=torch.bfloat16,
        attn_implementation="sdpa",
        token=os.environ["HF_TOKEN"],
    )
    merged = PeftModel.from_pretrained(base, str(adapter_dir))
    merged = merged.merge_and_unload()
    merged_dir = out_dir / "merged"
    merged.save_pretrained(str(merged_dir), safe_serialization=True)
    tok.save_pretrained(str(merged_dir))
    print(f"[train] merged model saved to {merged_dir}")

    # Write a meta file
    with open(out_dir / "meta.json", "w") as f:
        json.dump(
            {
                "run_name": run_name,
                "base_model": base_model,
                "user_id": user_id,
                "epochs": epochs,
                "lr": lr,
                "lora_r": lora_r,
                "lora_alpha": lora_alpha,
                "seq_len": seq_len,
                "micro_batch": micro_batch,
                "grad_accum": grad_accum,
                "train_examples": len(train_ds),
                "val_examples": len(val_ds),
                "training_seconds": dt,
            },
            f,
            indent=2,
        )

    volume.commit()
    print("[train] volume committed. done.")
    return {"run_name": run_name, "merged_dir": str(merged_dir)}


@app.local_entrypoint()
def main(
    user_id: str = "marcus-sa",
    base_model: str = "Qwen/Qwen2.5-7B-Instruct",
    run_name: str = "qwen25-7b-marcus-sa-v1",
    epochs: float = 1.0,
):
    print(
        train.remote(
            user_id=user_id, base_model=base_model, run_name=run_name, epochs=epochs
        )
    )
