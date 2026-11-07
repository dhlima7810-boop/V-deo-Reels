#!/bin/sh
# junta quadros + áudio, normaliza (-14 LUFS) e coloca a vinheta zuum. no FIM
set -e; NAME=$1; V=/mnt/project-files/branding/intro-zuum-1080x1920.mp4
ffmpeg -y -v error -i out/frames.mp4 -i out/mix.wav -map 0:v -map 1:a -c:v copy -af loudnorm=I=-14:TP=-1.5:LRA=11 -ar 48000 -c:a aac -b:a 192k -shortest out/corpo.mp4
ffmpeg -y -v error -i out/corpo.mp4 -i $V -filter_complex "[1:v]fps=60,scale=1080:1920,setsar=1[v1];[0:v]setsar=1[v0];[1:a]aformat=sample_rates=48000:channel_layouts=stereo[a1];[0:a]aformat=sample_rates=48000:channel_layouts=stereo[a0];[v0][a0][v1][a1]concat=n=2:v=1:a=1[v][a]" -map "[v]" -map "[a]" -c:v libx264 -preset medium -crf 19 -pix_fmt yuv420p -c:a aac -b:a 192k -movflags +faststart out/$NAME.mp4
ffprobe -v error -show_entries format=duration -of csv=p=0 out/$NAME.mp4
