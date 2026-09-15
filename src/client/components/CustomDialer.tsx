import { useEffect, useRef, useState } from "react";
import { Button, Modal } from "@heroui/react";
import { NAV_COPY } from "../copy";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "+", "0", "back"] as const;

function displayNumber(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "Enter a number";
  return trimmed;
}

export function CustomDialer({
  open,
  calling,
  error,
  disabledReason,
  onClose,
  onCall
}: {
  open: boolean;
  calling: boolean;
  error: string | null;
  disabledReason: string | null;
  onClose: () => void;
  onCall: (phone: string) => void;
}) {
  const [digits, setDigits] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return undefined;
    setDigits("");
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focus = window.requestAnimationFrame(() => inputRef.current?.focus());
    return () => {
      document.body.style.overflow = previousOverflow;
      window.cancelAnimationFrame(focus);
    };
  }, [open]);

  function append(value: string) {
    setDigits((current) => {
      if (value === "+" && current.includes("+")) return current;
      if (current.length >= 20) return current;
      return `${current}${value}`;
    });
  }

  function backspace() {
    setDigits((current) => current.slice(0, -1));
  }

  function submit() {
    if (calling || disabledReason || digits.trim().length < 3) return;
    onCall(digits);
  }

  return (
    <Modal.Backdrop isOpen={open} onOpenChange={(next) => { if (!next && !calling) onClose(); }}>
      <Modal.Container size="sm">
        <Modal.Dialog className="rounded-lg" aria-label={NAV_COPY.dial}>
          <Modal.CloseTrigger aria-label="Close" />
          <Modal.Header className="pr-8">
            <Modal.Heading>{NAV_COPY.dial}</Modal.Heading>
          </Modal.Header>
          <Modal.Body>
            <p className="max-w-[32em] text-sm leading-relaxed text-muted">
              Optional. This call is not a queue lead and is not written to the Sheet.
            </p>
            <label className="sr-only" htmlFor="custom-dial-number">
              Phone number
            </label>
            <input
              ref={inputRef}
              id="custom-dial-number"
              inputMode="tel"
              autoComplete="tel"
              className="mt-5 w-full border-0 bg-transparent text-center font-mono text-2xl font-semibold tracking-wide text-foreground outline-none placeholder:text-muted"
              placeholder="Enter a number"
              value={digits}
              disabled={calling}
              onChange={(event) => {
                setDigits(event.target.value.replace(/[^\d+]/g, "").slice(0, 20));
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  submit();
                }
              }}
            />
            <p className="sr-only" aria-live="polite">
              {displayNumber(digits)}
            </p>
            <div className="mx-auto mt-5 grid max-w-[240px] grid-cols-3 gap-2" role="group" aria-label="Dial pad">
              {KEYS.map((key) => {
                if (key === "back") {
                  return (
                    <Button
                      key={key}
                      variant="outline"
                      className="min-h-11 rounded-lg! font-semibold"
                      isDisabled={calling}
                      aria-label="Backspace"
                      onPress={backspace}
                    >
                      ⌫
                    </Button>
                  );
                }
                return (
                  <Button
                    key={key}
                    variant="outline"
                    className="min-h-11 rounded-lg! font-mono text-lg font-semibold"
                    isDisabled={calling}
                    aria-label={key === "+" ? "Add plus" : `Dial ${key}`}
                    onPress={() => append(key)}
                  >
                    {key}
                  </Button>
                );
              })}
            </div>
            {error ? (
              <p className="mt-4 text-sm text-danger" role="alert">
                {error}
              </p>
            ) : disabledReason ? (
              <p className="mt-4 text-sm text-muted">{disabledReason}</p>
            ) : null}
            <div className="mt-6 flex flex-wrap items-center justify-end gap-3">
              <Button variant="outline" className="min-h-11 rounded-lg!" isDisabled={calling} onPress={onClose}>
                Cancel
              </Button>
              <Button
                className="min-h-11 rounded-lg!"
                isDisabled={calling || Boolean(disabledReason) || digits.trim().length < 3}
                isPending={calling}
                onPress={submit}
              >
                {calling ? "Calling…" : "Call"}
              </Button>
            </div>
          </Modal.Body>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
