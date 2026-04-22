import { createRoot } from "react-dom/client";
import type { WidgetBootstrapOptions } from "@platform/types";
import { CustomerWidget } from "./widget";

type MountTarget = HTMLElement | string;

function resolveTarget(target: MountTarget): HTMLElement {
  if (typeof target !== "string") {
    return target;
  }

  const resolved = document.querySelector<HTMLElement>(target);

  if (!resolved) {
    throw new Error(`Customer widget target not found for selector: ${target}`);
  }

  return resolved;
}

export function mountCustomerWidget(target: MountTarget, options: WidgetBootstrapOptions) {
  const element = resolveTarget(target);
  const root = createRoot(element);

  root.render(<CustomerWidget {...options} />);

  return {
    unmount: () => root.unmount()
  };
}
