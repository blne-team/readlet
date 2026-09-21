# syntax=docker/dockerfile:1

FROM node:24-bookworm-slim

ARG USER_UID
ARG USER_GID

RUN apt-get update \
    && apt-get install --no-install-recommends --yes \
      ca-certificates curl git jq less openssh-client poppler-utils procps \
      ripgrep sudo tmux vim webp \
    && rm -rf /var/lib/apt/lists/* \
    && npm install --global pnpm@10.34.5

RUN test -n "$USER_UID" && test -n "$USER_GID" \
    && if [ "$(id -g node)" != "$USER_GID" ]; then groupmod --gid "$USER_GID" node; fi \
    && if [ "$(id -u node)" != "$USER_UID" ] || [ "$(id -g node)" != "$USER_GID" ]; then \
         usermod --uid "$USER_UID" --gid "$USER_GID" node; \
       fi \
    && chown -R node:node /home/node \
    && printf 'node ALL=(ALL) NOPASSWD:ALL\n' > /etc/sudoers.d/node \
    && chmod 0440 /etc/sudoers.d/node

USER node

RUN mkdir -p /home/node/.history \
    && printf '\nexport HISTFILE=$HOME/.history/.bash_history\nexport HISTSIZE=10000\nexport HISTFILESIZE=20000\nshopt -s histappend\nPROMPT_COMMAND="history -a"\n' >> /home/node/.bashrc

WORKDIR /workspaces/readlet
