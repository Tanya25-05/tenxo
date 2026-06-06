"""Tenxo CLI — package, encrypt, and submit AI training workspaces."""

import argparse
import sys

from . import __version__
from .pack import pack_workspace
from .client import cmd_init, cmd_run, cmd_list


def main():
    parser = argparse.ArgumentParser(
        prog="tenxo",
        description="Tenxo CLI — package and run AI workspaces on the decentralized GPU grid.",
    )
    parser.add_argument(
        "--version", action="version", version=f"tenxo {__version__}"
    )
    sub = parser.add_subparsers(dest="command")

    # pack
    pack_p = sub.add_parser("pack", help="Package workspace into a zip")
    pack_p.add_argument(
        "directory",
        nargs="?",
        default=".",
        help="Workspace directory to package (default: current dir)",
    )
    pack_p.add_argument(
        "-o", "--output",
        default="workspace.zip",
        help="Output zip path (default: workspace.zip)",
    )

    # init
    init_p = sub.add_parser("init", help="Configure API endpoint")
    init_p.add_argument("--api-url", required=True)
    init_p.add_argument("--api-key")

    # list
    list_p = sub.add_parser("list", help="List available GPU nodes on the grid")
    list_p.add_argument("--api-url")
    list_p.add_argument("--api-key")

    # run
    run_p = sub.add_parser(
        "run", help="Package, encrypt, upload, submit, and poll a job"
    )
    run_p.add_argument("path", help="Path to workspace directory")
    run_p.add_argument("--api-url")
    run_p.add_argument("--api-key")
    run_p.add_argument("--timeout", type=int, default=600)
    run_p.add_argument(
        "--gpu",
        dest="gpu_model",
        help='GPU SKU filter (e.g. "NVIDIA RTX 4090", "A100", "A5000")',
    )
    run_p.add_argument(
        "--node-id",
        help="Specific node ID to deploy on (overrides --gpu filter)",
    )
    run_p.add_argument(
        "--presign-ttl",
        type=int,
        default=None,
        help="Presigned URL TTL in seconds (default: SDK default ~15min)",
    )
    run_p.add_argument(
        "--script",
        default="main.py",
        help="Entrypoint script to run inside the container (default: main.py)",
    )
    run_p.add_argument(
        "--image",
        default=None,
        help="Docker image to use (default: pytorch/pytorch:2.1.0-cuda12.1-cudnn8-runtime)",
    )
    run_p.add_argument(
        "--job-type",
        default=None,
        choices=["python", "cuda", "blender", "custom"],
        help="Job runtime type (default: auto-detected from --script extension)",
    )

    args = parser.parse_args()

    if args.command == "pack":
        pack_workspace(args.directory, args.output)
    elif args.command == "init":
        cmd_init(args.api_url, args.api_key)
    elif args.command == "list":
        cmd_list(args.api_url, args.api_key)
    elif args.command == "run":
        cmd_run(args.path, args.api_url, args.api_key, args.timeout, args.gpu_model, args.node_id, args.presign_ttl, script=args.script, image=args.image, job_type=args.job_type)
    else:
        parser.print_help()
        sys.exit(1)


if __name__ == "__main__":
    main()
