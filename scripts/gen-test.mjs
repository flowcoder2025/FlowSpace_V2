const COMFY = "http://localhost:8000";
const res = await fetch(`${COMFY}/prompt`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    prompt: {
      "3": { class_type: "KSampler", inputs: { seed: 42, steps: 20, cfg: 7, sampler_name: "euler", scheduler: "normal", denoise: 1.0, model: ["4", 0], positive: ["6", 0], negative: ["7", 0], latent_image: ["5", 0] }},
      "4": { class_type: "CheckpointLoaderSimple", inputs: { ckpt_name: "pixelArtDiffusionXL_spriteShaper.safetensors" }},
      "5": { class_type: "EmptyLatentImage", inputs: { width: 512, height: 512, batch_size: 1 }},
      "6": { class_type: "CLIPTextEncode", inputs: { text: "pixel art knight, blue armor, sword and shield", clip: ["4", 1] }},
      "7": { class_type: "CLIPTextEncode", inputs: { text: "blurry, ugly, text", clip: ["4", 1] }},
      "8": { class_type: "VAEDecode", inputs: { samples: ["3", 0], vae: ["4", 2] }},
      "9": { class_type: "SaveImage", inputs: { filename_prefix: "flowspace_knight", images: ["8", 0] }},
    },
  }),
});
const data = await res.json();
console.log("Prompt:", data.prompt_id);

for (let i = 0; i < 30; i++) {
  await new Promise(r => setTimeout(r, 3000));
  const h = await fetch(`${COMFY}/history/${data.prompt_id}`).then(r => r.json());
  const item = Object.values(h)[0];
  if (!item) { console.log(`[${(i+1)*3}s] waiting`); continue; }
  const s = item.status?.status_str;
  if (s === "success") {
    console.log(`[${(i+1)*3}s] SUCCESS!`, JSON.stringify(item.outputs?.["9"]?.images));
    process.exit(0);
  }
  if (s === "error") {
    for (const m of item.status.messages) {
      if (m[0] === "execution_error") console.log("ERROR:", m[1]?.exception_message?.slice(0, 200));
    }
    process.exit(1);
  }
  console.log(`[${(i+1)*3}s] ${s || "processing"}...`);
}
