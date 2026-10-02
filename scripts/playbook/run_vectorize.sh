#!/usr/bin/env bash
# Trace every page in one low-memory process (this PC runs short of commit memory with several).
export OPENBLAS_NUM_THREADS=1 OMP_NUM_THREADS=1 MKL_NUM_THREADS=1 PYTHONIOENCODING=utf-8
python -W ignore scripts/playbook/vectorize.py --all "${1:-1}" "${2:-477}"
