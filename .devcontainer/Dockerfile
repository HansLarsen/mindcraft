FROM node:latest AS developer

ARG USERNAME=node

RUN apt update && apt install -y sudo
RUN echo $USERNAME ALL=\(root\) NOPASSWD:ALL > /etc/sudoers.d/$USERNAME

RUN apt install -y python-is-python3 \
    libxi-dev \
    mesa-vulkan-drivers \
    mesa-utils \
    libglx-dev \
    libgl-dev \
    libgl1-mesa-glx \
    libx11-dev \
    espeak

RUN npm install -g npm@11.3.0

ENV NVIDIA_DRIVER_CAPABILITIES all
ENV NVIDIA_VISIBLE_DEVICES all