"""Shared Modal config: app, image, volume."""
import modal

APP_NAME = "user-sim-marcus-sa"

# Volume V2 for heavy storage: HF cache, processed datasets, model checkpoints.
volume = modal.Volume.from_name("user-sim-vol", version=2, create_if_missing=True)
VOL_MOUNT = "/vol"

HF_CACHE = f"{VOL_MOUNT}/hf_cache"
DATA_DIR = f"{VOL_MOUNT}/data"
CKPT_DIR = f"{VOL_MOUNT}/ckpt"

# Base image for data prep (light)
data_image = (
    modal.Image.debian_slim(python_version="3.11")
    .pip_install(
        "datasets==4.4.1",
        "huggingface_hub==0.36.0",
        "pandas==2.2.3",
        "pyarrow==21.0.0",
        "jinja2==3.1.6",
    )
    .env({"HF_HOME": HF_CACHE})
    .add_local_python_source("common")
)

# Heavy image for training: CUDA + torch + trl + peft
train_image = (
    modal.Image.from_registry("nvidia/cuda:12.4.1-cudnn-devel-ubuntu22.04", add_python="3.11")
    .apt_install("git", "build-essential")
    .pip_install(
        "torch==2.5.1",
        "transformers==4.46.3",
        "accelerate==1.1.1",
        "peft==0.13.2",
        "trl==0.12.1",
        "datasets==4.4.1",
        "bitsandbytes==0.44.1",
        "deepspeed==0.15.4",
        "huggingface_hub==0.36.0",
        "wandb==0.18.7",
        "tensorboard==2.18.0",
        "sentencepiece==0.2.0",
        "tiktoken==0.8.0",
        "protobuf==5.28.3",
    )
    .env({"HF_HOME": HF_CACHE, "TOKENIZERS_PARALLELISM": "false"})
    .add_local_python_source("common")
)

# Inference image: vLLM
serve_image = (
    modal.Image.debian_slim(python_version="3.11")
    .pip_install(
        # vLLM 0.7+ supports Qwen3. 0.8 is current as of mid-2025.
        "vllm==0.8.5",
        "huggingface_hub==0.36.0",
    )
    .env({"HF_HOME": HF_CACHE, "VLLM_USE_V1": "0"})
    .add_local_python_source("common")
)

app = modal.App(APP_NAME)
