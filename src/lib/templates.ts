import { basename, extname } from "node:path";
import type { TemplateConfig, VideoMetadata } from "../youtube/types.js";

export function titleFromFilename(filePath: string): string {
  const name = basename(filePath);
  const ext = extname(name);
  return ext ? name.slice(0, -ext.length) : name;
}

function applyTitleTemplate(baseTitle: string, template: TemplateConfig): string {
  if (!template.title) {
    return baseTitle;
  }
  return template.title.replaceAll("{{title}}", baseTitle);
}

export function applyTemplate(
  baseTitle: string,
  template: TemplateConfig,
): VideoMetadata {
  const title = applyTitleTemplate(baseTitle, template);
  const description = template.description.replaceAll("{{title}}", baseTitle);

  return {
    title,
    description,
    tags: [...template.tags],
    categoryId: template.categoryId,
    defaultLanguage: template.defaultLanguage,
  };
}

export function buildMetadata(
  filePath: string,
  template: TemplateConfig,
): VideoMetadata {
  const title = titleFromFilename(filePath);
  return applyTemplate(title, template);
}
