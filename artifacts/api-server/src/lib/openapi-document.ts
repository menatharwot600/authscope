import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse } from "yaml";

const candidates = [
  resolve(process.cwd(), "lib/api-spec/openapi.yaml"),
  resolve(process.cwd(), "../../lib/api-spec/openapi.yaml"),
];
const specPath = candidates.find((candidate) => existsSync(candidate));

if (!specPath) {
  throw new Error(
    "The AuthScope OpenAPI contract could not be found from the API server working directory.",
  );
}

const openApiDocument = parse(readFileSync(specPath, "utf8")) as {
  info: { title: string; [key: string]: unknown };
  [key: string]: unknown;
};
openApiDocument.info.title = "AuthScope API";

export default openApiDocument;
