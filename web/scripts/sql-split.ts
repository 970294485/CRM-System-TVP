/** Split SQL text on semicolons outside strings / dollar-quotes / line comments. */
export function splitSqlStatements(sqlText: string): string[] {
  const statements: string[] = [];
  let buf = "";
  let i = 0;
  let inLineComment = false;
  let inString = false;
  let dollarEnd: string | null = null;
  const len = sqlText.length;

  while (i < len) {
    const c = sqlText[i]!;

    if (inLineComment) {
      buf += c;
      if (c === "\n") inLineComment = false;
      i++;
      continue;
    }

    if (dollarEnd !== null) {
      if (sqlText.startsWith(dollarEnd, i)) {
        buf += dollarEnd;
        i += dollarEnd.length;
        dollarEnd = null;
        continue;
      }
      buf += c;
      i++;
      continue;
    }

    if (inString) {
      buf += c;
      if (c === "'" && sqlText[i + 1] === "'") {
        buf += "'";
        i += 2;
        continue;
      }
      if (c === "'") inString = false;
      i++;
      continue;
    }

    if (c === "-" && sqlText[i + 1] === "-") {
      inLineComment = true;
      buf += "--";
      i += 2;
      continue;
    }

    if (c === "'") {
      inString = true;
      buf += c;
      i++;
      continue;
    }

    if (c === "$") {
      if (sqlText[i + 1] === "$") {
        dollarEnd = "$$";
        buf += "$$";
        i += 2;
        continue;
      }
      const rest = sqlText.slice(i);
      const m = rest.match(/^\$([a-zA-Z_][a-zA-Z0-9_]*)\$/);
      if (m) {
        dollarEnd = m[0];
        buf += dollarEnd;
        i += dollarEnd.length;
        continue;
      }
    }

    if (c === ";") {
      const s = buf.trim();
      if (s.length > 0) statements.push(s);
      buf = "";
      i++;
      continue;
    }

    buf += c;
    i++;
  }
  const tail = buf.trim();
  if (tail.length > 0) statements.push(tail);
  return statements;
}
