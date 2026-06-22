"use client";

import { useRef, useState, type ChangeEvent } from "react";
import Cropper, { type Area } from "react-easy-crop";
import type { AccountRecord } from "@platform/types";

export function UserAvatarEditor({
  apiBaseUrl,
  account,
  onAccountChanged
}: {
  apiBaseUrl: string;
  account: AccountRecord;
  onAccountChanged?: (account: AccountRecord) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [source, setSource] = useState<string>();
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedArea, setCroppedArea] = useState<Area>();
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string>();

  function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) return;
    if (!new Set(["image/png", "image/jpeg", "image/webp"]).has(file.type)) {
      setError("Choose a PNG, JPEG, or WebP image.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("The source image must be 10 MB or smaller.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setSource(reader.result);
        setCrop({ x: 0, y: 0 });
        setZoom(1);
        setError(undefined);
      }
    };
    reader.onerror = () => setError("Unable to read the selected image.");
    reader.readAsDataURL(file);
  }

  async function saveAvatar() {
    if (!source || !croppedArea) return;
    setIsSaving(true);
    setError(undefined);

    try {
      const avatarDataUrl = await createCroppedAvatar(source, croppedArea);
      const response = await fetch(`${apiBaseUrl}/account/me/avatar`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ avatarDataUrl })
      });

      if (!response.ok) {
        throw new Error(await readErrorMessage(response));
      }

      const updatedAccount = (await response.json()) as AccountRecord;
      onAccountChanged?.(updatedAccount);
      setSource(undefined);
    } catch (saveError: unknown) {
      setError(saveError instanceof Error ? saveError.message : "Unable to update avatar.");
    } finally {
      setIsSaving(false);
    }
  }

  const initials = (account.name || account.email || "U")
    .split(/\s+|@/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  return (
    <section className="user-avatar-editor" aria-labelledby="user-avatar-heading">
      <div className="user-avatar-preview" aria-hidden="true">
        {account.avatarUrl ? <img src={account.avatarUrl} alt="" /> : <span>{initials}</span>}
      </div>
      <div className="user-avatar-copy">
        <h3 id="user-avatar-heading">Profile photo</h3>
        <p>Upload and crop the photo shown in your account and workspace header.</p>
      </div>
      <input
        ref={inputRef}
        className="sr-only"
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={chooseFile}
      />
      <button type="button" className="secondary-btn avatar-upload-trigger" onClick={() => inputRef.current?.click()}>
        <span className="material-symbols-outlined" aria-hidden="true">upload</span>
        <span>{account.avatarUrl ? "Update photo" : "Upload photo"}</span>
      </button>
      {error ? <div className="inline-error user-avatar-error">{error}</div> : null}

      {source ? (
        <div className="avatar-crop-backdrop" role="dialog" aria-modal="true" aria-labelledby="avatar-crop-title">
          <div className="avatar-crop-dialog">
            <header>
              <div>
                <p className="eyebrow">Profile photo</p>
                <h3 id="avatar-crop-title">Crop avatar</h3>
              </div>
              <button type="button" className="icon-only-button" aria-label="Close crop editor" onClick={() => setSource(undefined)}>
                <span className="material-symbols-outlined" aria-hidden="true">close</span>
              </button>
            </header>
            <div className="avatar-crop-surface">
              <Cropper
                image={source}
                crop={crop}
                zoom={zoom}
                aspect={1}
                cropShape="round"
                showGrid={false}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={(_area, pixels) => setCroppedArea(pixels)}
              />
            </div>
            <label className="avatar-zoom-control">
              <span>Zoom</span>
              <input type="range" min={1} max={3} step={0.01} value={zoom} onChange={(event) => setZoom(Number(event.target.value))} />
            </label>
            <footer>
              <button type="button" className="secondary-btn" onClick={() => setSource(undefined)}>Cancel</button>
              <button type="button" className="primary-btn" disabled={isSaving || !croppedArea} onClick={() => void saveAvatar()}>
                {isSaving ? "Saving..." : "Save photo"}
              </button>
            </footer>
          </div>
        </div>
      ) : null}
    </section>
  );
}

async function createCroppedAvatar(source: string, area: Area): Promise<string> {
  const image = await loadImage(source);
  const canvas = document.createElement("canvas");
  const outputSize = 512;
  canvas.width = outputSize;
  canvas.height = outputSize;
  const context = canvas.getContext("2d");

  if (!context) throw new Error("This browser cannot crop images.");
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(image, area.x, area.y, area.width, area.height, 0, 0, outputSize, outputSize);

  let quality = 0.88;
  let result = canvas.toDataURL("image/jpeg", quality);
  while (dataUrlByteLength(result) > 500 * 1024 && quality > 0.5) {
    quality -= 0.08;
    result = canvas.toDataURL("image/jpeg", quality);
  }

  if (dataUrlByteLength(result) > 512 * 1024) {
    throw new Error("The cropped image is still too large. Choose a simpler image.");
  }
  return result;
}

function loadImage(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Unable to decode the selected image."));
    image.src = source;
  });
}

function dataUrlByteLength(value: string): number {
  const base64 = value.split(",", 2)[1] ?? "";
  return Math.ceil(base64.length * 0.75);
}

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as { message?: string | string[] };
    return Array.isArray(payload.message) ? payload.message.join(" ") : payload.message || `Avatar update failed with status ${response.status}.`;
  } catch {
    return `Avatar update failed with status ${response.status}.`;
  }
}
