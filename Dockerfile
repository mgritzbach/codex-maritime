FROM ghcr.io/mariagorskikh/openclaw-identity:2026.7.6

USER root
WORKDIR /opt/codex-maritime
COPY package.json ./
COPY .codex-plugin ./.codex-plugin
COPY .mcp.json ./
COPY skills ./skills
COPY scripts ./scripts
COPY src ./src
RUN mkdir -p /data
ENV PORT=8787 CODEX_MARITIME_STATE_PATH=/data/state.json
EXPOSE 8787
CMD ["node", "scripts/cli.mjs", "gateway"]