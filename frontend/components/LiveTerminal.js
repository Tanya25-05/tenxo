import React, { useEffect, useState } from "react";

export default function LiveTerminal({ lines }) {
  const [display, setDisplay] = useState("");

  useEffect(() => {
    let idx = 0;
    let out = "";
    let cancelled = false;

    function typeLine(line, cb) {
      let i = 0;
      const t = setInterval(() => {
        out += line[i++];
        setDisplay(out + "\n");
        if (i >= line.length) {
          clearInterval(t);
          cb();
        }
      }, 8);
    }

    function run() {
      if (idx >= lines.length || cancelled) return;
      typeLine(lines[idx], () => {
        out += "\n";
        idx++;
        run();
      });
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [lines]);

  return <pre className="code-block h-64 overflow-auto">{display}</pre>;
}
