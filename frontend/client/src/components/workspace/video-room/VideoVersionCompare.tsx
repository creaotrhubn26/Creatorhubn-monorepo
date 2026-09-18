// @ts-nocheck
import React, { useEffect, useRef, useState } from "react";
import { Box, Button, Slider, Stack, Typography } from "@mui/material";

const attachSource = async (video: HTMLVideoElement, src: string) => {
  if (!/\.m3u8(?:$|\?)/i.test(src) && !/\/manifest\/video/i.test(src)) {
    video.src = src;
    return null;
  }
  if (video.canPlayType("application/vnd.apple.mpegurl")) {
    video.src = src;
    return null;
  }
  const { default: Hls } = await import("hls.js");
  if (!Hls.isSupported()) {
    video.src = src;
    return null;
  }
  const hls = new Hls({ enableWorker: true });
  hls.loadSource(src);
  hls.attachMedia(video);
  return hls;
};

const VideoVersionCompare: React.FC<{ left: any; right: any }> = ({
  left,
  right,
}) => {
  const leftRef = useRef<HTMLVideoElement>(null);
  const rightRef = useRef<HTMLVideoElement>(null);
  const [duration, setDuration] = useState(0);
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    let leftHls: any = null;
    let rightHls: any = null;
    let cancelled = false;
    Promise.all([
      attachSource(leftRef.current!, left.fileUrl),
      attachSource(rightRef.current!, right.fileUrl),
    ]).then(([a, b]) => {
      if (cancelled) {
        a?.destroy();
        b?.destroy();
      } else {
        leftHls = a;
        rightHls = b;
      }
    });
    return () => {
      cancelled = true;
      leftHls?.destroy();
      rightHls?.destroy();
    };
  }, [left.id, left.fileUrl, right.id, right.fileUrl]);
  useEffect(() => {
    const leader = leftRef.current;
    if (!leader) return;
    const onTime = () => {
      setTime(leader.currentTime);
      if (
        rightRef.current &&
        Math.abs(rightRef.current.currentTime - leader.currentTime) > 0.12
      )
        rightRef.current.currentTime = leader.currentTime;
    };
    const onMeta = () =>
      setDuration(
        Math.min(leader.duration || 0, rightRef.current?.duration || Infinity),
      );
    leader.addEventListener("timeupdate", onTime);
    leader.addEventListener("loadedmetadata", onMeta);
    return () => {
      leader.removeEventListener("timeupdate", onTime);
      leader.removeEventListener("loadedmetadata", onMeta);
    };
  }, [left.id, right.id]);
  const toggle = async () => {
    const videos = [leftRef.current, rightRef.current].filter(
      Boolean,
    ) as HTMLVideoElement[];
    if (playing) videos.forEach((video) => video.pause());
    else
      await Promise.all(
        videos.map((video) => video.play().catch(() => undefined)),
      );
    setPlaying(!playing);
  };
  const seek = (value: number) => {
    [leftRef.current, rightRef.current].forEach((video) => {
      if (video) video.currentTime = value;
    });
    setTime(value);
  };
  return (
    <Stack spacing={1.5}>
      <Stack direction={{ xs: "column", md: "row" }} spacing={1}>
        <Box sx={{ flex: 1 }}>
          <Typography sx={{ fontWeight: 700, mb: 0.5 }}>
            {left.versionLabel}
          </Typography>
          <Box
            component="video"
            ref={leftRef}
            muted
            playsInline
            sx={{
              width: "100%",
              bgcolor: "#000",
              aspectRatio: "16 / 9",
              objectFit: "contain",
            }}
          />
        </Box>
        <Box sx={{ flex: 1 }}>
          <Typography sx={{ fontWeight: 700, mb: 0.5 }}>
            {right.versionLabel}
          </Typography>
          <Box
            component="video"
            ref={rightRef}
            muted
            playsInline
            sx={{
              width: "100%",
              bgcolor: "#000",
              aspectRatio: "16 / 9",
              objectFit: "contain",
            }}
          />
        </Box>
      </Stack>
      <Stack direction="row" spacing={2} alignItems="center">
        <Button variant="contained" onClick={toggle}>
          {playing ? "Pause begge" : "Spill begge"}
        </Button>
        <Slider
          min={0}
          max={duration || 1}
          step={0.04}
          value={Math.min(time, duration || 1)}
          onChange={(_, value) => seek(value as number)}
        />
        <Typography sx={{ minWidth: 74, fontVariantNumeric: "tabular-nums" }}>
          {time.toFixed(2)} s
        </Typography>
      </Stack>
    </Stack>
  );
};

export default VideoVersionCompare;
