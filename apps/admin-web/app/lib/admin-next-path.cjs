function sanitizeAdminNextPath(value) {
  if (typeof value !== "string") {
    return "/admin";
  }

  const nextPath = value.trim();

  if (
    !nextPath.startsWith("/") ||
    nextPath.startsWith("//") ||
    nextPath.includes("\\") ||
    /^[a-z][a-z0-9+.-]*:/i.test(nextPath)
  ) {
    return "/admin";
  }

  return nextPath;
}

module.exports = {
  sanitizeAdminNextPath
};
