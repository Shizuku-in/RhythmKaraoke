import type { MouseEvent } from "react";
import type { CheckRef } from "../domain/rhythmProject";
import { splitJapaneseMora } from "../domain/rhythmProject";

export function LyricCellView(props: {
  cellText: string;
  ruby?: string;
  checks: CheckRef["check"][];
  isCurrent: boolean;
  isSelected: boolean;
  onSelect: () => void;
  onContextMenu: (event: MouseEvent) => void;
  refCallback: (element: HTMLButtonElement | null) => void;
}) {
  const {
    cellText,
    ruby,
    checks,
    isCurrent,
    isSelected,
    onSelect,
    onContextMenu,
    refCallback,
  } = props;
  const orderedChecks = [
    ...checks.filter((check) => !check.keyUp),
    ...checks.filter((check) => check.keyUp),
  ];
  const keyDownChecks = checks.filter((check) => !check.keyUp);
  const timedKeyDownCount = keyDownChecks.filter((check) => check.timeMs !== null).length;
  const rubyMora = ruby ? splitJapaneseMora(ruby) : [];
  const hasTimedCheck = ruby
    ? keyDownChecks.length > 0 &&
      keyDownChecks.every((check) => check.timeMs !== null)
    : checks.some((check) => check.timeMs !== null);
  const hasKeyUp = checks.some((check) => check.keyUp);

  return (
    <button
      className={[
        "lyric-cell",
        isSelected ? "selected" : "",
        isCurrent ? "current" : "",
        hasTimedCheck ? "timed" : "",
        hasKeyUp ? "keyup" : "",
      ].join(" ")}
      onClick={(event) => {
        event.currentTarget.blur();
        onSelect();
      }}
      onContextMenu={onContextMenu}
      ref={refCallback}
      type="button"
    >
      {ruby ? (
        <span className="cell-ruby">
          {rubyMora.map((mora, index) => (
            <span
              className={[
                "cell-ruby-mora",
                index < timedKeyDownCount ? "timed" : "",
              ].join(" ")}
              key={`${mora}-${index}`}
            >
              {mora}
            </span>
          ))}
        </span>
      ) : (
        <span className="cell-ruby" />
      )}
      <span className="cell-text">{cellText === " " ? "\u00a0" : cellText}</span>
      <span className="check-row">
        {orderedChecks.map((check, checkIndex) => (
          <span
            className={[
              "check-mark",
              checkIndex > 0 && !check.keyUp ? "extra" : "",
              check.timeMs !== null ? "set" : "",
              check.keyUp ? "release" : "",
            ].join(" ")}
            key={check.id}
          />
        ))}
      </span>
    </button>
  );
}
