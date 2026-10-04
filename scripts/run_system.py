#!/usr/bin/env python3
"""Inicia as worktrees locais da Agenda sem substituir servidores existentes."""

import argparse
import json
import math
import os
from pathlib import Path
import re
import shutil
import signal
import socket
import subprocess
import sys
import time
from urllib.error import HTTPError, URLError
from urllib.request import build_opener, ProxyHandler

SERVICES = (
    ("Backend", "agenda-backend", 3000, "/api/health"),
    ("Preview", "agenda-booking-ui", 3001, "/preview"),
    ("Landing", "agenda-conversion", 3005, "/"),
    ("Painel", "agenda-dashboard", 3343, "/dashboard/login"),
)
HTTP = build_opener(ProxyHandler({}))


def listening(port):
    try:
        with socket.create_connection(("127.0.0.1", port), timeout=0.5):
            return True
    except OSError:
        return False


def ready(url):
    try:
        with HTTP.open(url, timeout=2) as response:
            return response.status == 200
    except (HTTPError, URLError, OSError):
        return False


def belongs_to(port, directory):
    """Recusa reutilizar uma porta cujo dono não possa ser identificado."""
    if not shutil.which("ss"):
        return False
    result = subprocess.run(
        ["ss", "-ltnp", f"sport = :{port}"],
        capture_output=True, text=True, check=True,
    )
    pids = re.findall(r"pid=(\d+)", result.stdout)
    if not pids:
        return False
    for pid in pids:
        try:
            cwd = Path(f"/proc/{pid}/cwd").resolve(strict=True)
        except OSError:
            return False
        if cwd != directory and directory not in cwd.parents:
            return False
    return True


def stop_owned(children):
    for process in children:
        # pnpm pode ter encerrado antes do filho Next.js.
        try:
            os.killpg(process.pid, signal.SIGTERM)
        except ProcessLookupError:
            pass
    deadline = time.monotonic() + 8
    for process in children:
        try:
            process.wait(timeout=max(0.01, deadline - time.monotonic()))
        except subprocess.TimeoutExpired:
            try:
                os.killpg(process.pid, signal.SIGKILL)
            except ProcessLookupError:
                pass
            process.wait()
    for process in children:
        try:
            os.killpg(process.pid, signal.SIGKILL)
        except ProcessLookupError:
            pass


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path,
                        default=Path(__file__).resolve().parents[2],
                        help="Pasta que contém as quatro worktrees agenda-*")
    parser.add_argument("--check", action="store_true", help="Verifica sem iniciar processos")
    parser.add_argument("--with-db", action="store_true", help="Executa pnpm db:up do backend")
    parser.add_argument("--timeout", type=float, default=120, help="Prazo total de inicialização, em segundos")
    args = parser.parse_args()
    if not math.isfinite(args.timeout) or args.timeout <= 0:
        parser.error("--timeout deve ser positivo")
    if args.check and args.with_db:
        parser.error("--check não pode iniciar banco; remova --with-db")
    if os.name != "posix":
        parser.error("Este launcher exige Linux/POSIX")
    root = args.root.resolve()
    children = []
    logs = []
    try:
        pnpm = shutil.which("pnpm")
        if not args.check and not pnpm:
            raise RuntimeError("pnpm não encontrado. Instale as dependências do projeto primeiro.")
        # Verifica todas as pastas/portas antes de iniciar qualquer serviço.
        entries = []
        for name, folder, port, route in SERVICES:
            directory = root / folder
            package = directory / "package.json"
            if not package.is_file():
                raise RuntimeError(f"Worktree ausente: {directory}")
            existing = listening(port)
            if existing and not belongs_to(port, directory):
                raise RuntimeError(f"Porta {port} ocupada por processo desconhecido ou outra worktree; nenhum processo foi encerrado.")
            if not args.check and not existing:
                if not (directory / "node_modules/next/package.json").is_file():
                    raise RuntimeError(f"Dependências ausentes em {directory}. Execute pnpm install nessa pasta.")
                if "dev" not in json.loads(package.read_text()).get("scripts", {}):
                    raise RuntimeError(f"Script dev ausente em {package}")
            entries.append((name, directory, port, f"http://localhost:{port}{route}", existing))
        if args.check:
            ok = True
            for name, _, _, url, _ in entries:
                healthy = ready(url)
                print(f"{'OK' if healthy else 'INDISPONÍVEL'} {name}: {url}", flush=True)
                ok = ok and healthy
            return 0 if ok else 1
        if args.with_db:
            subprocess.run([pnpm, "db:up"], cwd=root / "agenda-backend", check=True,
                           stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=120)
            print("Banco iniciado pelo Compose existente; migrations não executadas.", flush=True)
        log_directory = root / "agenda-backend/.maestri/run-system-logs"
        log_directory.mkdir(parents=True, exist_ok=True, mode=0o700)
        for name, directory, port, url, existing in entries:
            if existing:
                print(f"Reutilizando {name}: {url}", flush=True)
                continue
            log_path = log_directory / f"{directory.name}-{os.getpid()}.log"
            fd = os.open(log_path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
            log = os.fdopen(fd, "w")
            logs.append(log)
            env = os.environ.copy()
            env["BETTER_AUTH_URL"] = f"http://localhost:{port}"
            process = subprocess.Popen(
                [pnpm, "dev", "--hostname", "127.0.0.1", "--port", str(port)],
                cwd=directory, env=env, stdout=log, stderr=subprocess.STDOUT,
                start_new_session=True,
            )
            children.append(process)
            print(f"Iniciando {name}; log local privado: {log_path}", flush=True)
        deadline = time.monotonic() + args.timeout
        pending = list(entries)
        while pending:
            for process in children:
                if process.poll() is not None:
                    raise RuntimeError("Um servidor encerrou durante inicialização. Consulte seu log local sem publicar segredos.")
            pending = [entry for entry in pending if not ready(entry[3])]
            if pending and time.monotonic() >= deadline:
                raise RuntimeError("Prazo excedido: " + ", ".join(entry[0] for entry in pending))
            if pending:
                time.sleep(0.5)
        for name, _, _, url, _ in entries:
            print(f"OK {name}: {url}", flush=True)
        print("HTTP disponível não comprova banco, SMTP ou Pix real.", flush=True)
        if not children:
            print("Todos os servidores já estavam ativos; nada novo para supervisionar.", flush=True)
            return 0
        print("Ctrl+C encerra somente servidores iniciados aqui; banco e servidores anteriores permanecem.", flush=True)
        while True:
            for process in children:
                if process.poll() is not None:
                    raise RuntimeError("Um servidor encerrou; finalizando os demais servidores deste launcher.")
            time.sleep(1)
    except KeyboardInterrupt:
        print("\nEncerrando servidores deste launcher.", flush=True)
        return 0
    except (OSError, RuntimeError, ValueError, subprocess.SubprocessError) as error:
        # Erros de subprocesso não incluem saída que possa conter credenciais.
        print(f"Erro: {error}", file=sys.stderr)
        return 1
    finally:
        stop_owned(children)
        for log in logs:
            log.close()


def handle_termination(signum, frame):
    raise KeyboardInterrupt


if __name__ == "__main__":
    signal.signal(signal.SIGTERM, handle_termination)
    sys.exit(main())
