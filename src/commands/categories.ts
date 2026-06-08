import { listVideoCategories } from "../youtube/api.js";
import { getAuthorizedClient } from "../youtube/auth.js";

const REGION_CODE_PATTERN = /^[A-Za-z]{2}$/;

export interface CategoriesListOptions {
  region?: string;
  hl?: string;
  all?: boolean;
}

export async function runCategoriesList(
  options: CategoriesListOptions,
): Promise<void> {
  const regionCode = (options.region ?? "JP").toUpperCase();
  const hl = options.hl ?? "ja";
  const includeAll = options.all ?? false;

  if (!REGION_CODE_PATTERN.test(regionCode)) {
    throw new Error(
      `--region must be an ISO 3166-1 alpha-2 code (e.g. JP, US). Got: ${regionCode}`,
    );
  }

  const auth = await getAuthorizedClient();
  const categories = await listVideoCategories(auth, { regionCode, hl });
  const visible = includeAll
    ? categories
    : categories.filter((category) => category.assignable);

  console.log(`Region: ${regionCode}`);
  console.log(`Language: ${hl}`);
  if (!includeAll) {
    console.log("Showing assignable categories only (use --all to include all).");
  }
  console.log("");

  if (visible.length === 0) {
    console.log("No categories found.");
    return;
  }

  const idWidth = Math.max(
    ...visible.map((category) => category.id.length),
    2,
  );

  for (const category of visible) {
    console.log(`${category.id.padStart(idWidth)}  ${category.title}`);
  }
}
