FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    texlive-full latexmk biber \
  && rm -rf /var/lib/apt/lists/*

RUN useradd -m -u 1000 latex
USER latex
WORKDIR /workspace

ENTRYPOINT ["latexmk"]
