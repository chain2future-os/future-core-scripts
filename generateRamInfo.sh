#!/usr/bin/env bash
NAME=$1
/root/workspace/future-core/build/tools/ws2json --in /root/.local/share/futureio/wssfuture/data/worldstate/$NAME -o /tmp/ -t -j
