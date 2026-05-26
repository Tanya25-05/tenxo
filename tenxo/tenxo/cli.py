"""Tenxo CLI — package, encrypt, and submit AI training workspaces."""

import argparse
import sys

from . import __version__
from .pack import pack_workspace
from .client import cmd_init, cmd_run


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

    # run
    run_p = sub.add_parser(
        "run", help="Package, encrypt, upload, submit, and poll a job"
    )
    run_p.add_argument("path", help="Path to workspace directory")
    run_p.add_argument("--api-url")
    run_p.add_argument("--api-key")
    run_p.add_argument("--timeout", type=int, default=600)

    args = parser.parse_args()

    if args.command == "pack":
        pack_workspace(args.directory, args.output)
    elif args.command == "init":
        cmd_init(args.api_url, args.api_key)
    elif args.command == "run":
        cmd_run(args.path, args.api_url, args.api_key, args.timeout)
    else:
        parser.print_help()
        sys.exit(1)


if __name__ == "__main__":
    main()
