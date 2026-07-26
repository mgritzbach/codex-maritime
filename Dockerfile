FROM node:22-bookworm-slim
WORKDIR /app
COPY --chmod=0755 runtime/maritime-init /sbin/maritime-init
COPY package.json ./
COPY .codex-plugin ./.codex-plugin
COPY .mcp.json ./
COPY skills ./skills
COPY scripts ./scripts
COPY src ./src
RUN mkdir -p /data && chown -R node:node /app /data
USER node
ENV PORT=8787 CODEX_MARITIME_STATE_PATH=/data/state.json
EXPOSE 8787
CMD ["node", "scripts/cli.mjs", "gateway"]