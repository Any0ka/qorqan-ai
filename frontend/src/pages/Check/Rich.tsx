import { Fragment } from 'react';

/** Renders copy with `**bold**` markers (used by qorgan AI answers and by our own dictionaries). */
export function Rich({ text, boldClass }: { text: string; boldClass?: string }) {
  const lines = text.split('\n');
  return (
    <>
      {lines.map((line, li) => (
        <Fragment key={li}>
          {li > 0 && <br />}
          {line.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
            part.length > 4 && part.startsWith('**') && part.endsWith('**') ? (
              <b key={i} className={boldClass}>
                {part.slice(2, -2)}
              </b>
            ) : (
              <Fragment key={i}>{part}</Fragment>
            ),
          )}
        </Fragment>
      ))}
    </>
  );
}
