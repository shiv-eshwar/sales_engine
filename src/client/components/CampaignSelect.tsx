import { Label, ListBox, Select } from "@heroui/react";
import type { PublicCampaign } from "../../shared/contracts";
import "./CampaignSelect.css";

const ALL = "__all__";

const itemClass =
  "campaign-select-option rounded-lg! ps-3 pe-3 py-2 text-sm text-foreground data-[hovered=true]:bg-default data-[selected=true]:bg-accent-soft data-[selected=true]:text-accent-soft-foreground data-[selected=true]:data-[hovered=true]:bg-accent-soft";

export function CampaignSelect({
  campaigns,
  value,
  onChange,
  ariaLabel,
  isDisabled,
  appearance = "field",
  includeAll = false,
  className,
  id,
  title
}: {
  campaigns: Array<Pick<PublicCampaign, "id" | "name">>;
  value: string;
  onChange: (campaignId: string) => void;
  ariaLabel: string;
  isDisabled?: boolean;
  appearance?: "header" | "field";
  includeAll?: boolean;
  className?: string;
  id?: string;
  title?: string;
}) {
  const selected = includeAll ? value || ALL : value;
  const header = appearance === "header";
  const triggerId = id ?? "campaign-select";
  const selectedName =
    selected === ALL ? "All campaigns" : campaigns.find((item) => item.id === selected)?.name;

  return (
    <div
      className={["campaign-select", header ? "campaign-select--header" : "", className].filter(Boolean).join(" ")}
      title={title ?? selectedName}
    >
      <label htmlFor={triggerId} className="sr-only">{ariaLabel}</label>
      <Select
        fullWidth={!header}
        isDisabled={isDisabled}
        placeholder={includeAll ? "All campaigns" : "Campaign"}
        value={selected || null}
        variant="secondary"
        onChange={(next) => {
          if (typeof next !== "string") return;
          onChange(next === ALL ? "" : next);
        }}
      >
        <Label className="sr-only">{ariaLabel}</Label>
        <Select.Trigger
          id={triggerId}
          className={
            header
              ? "h-9 min-h-9 min-w-0 justify-start overflow-hidden border-0 bg-transparent ps-2 pe-7 shadow-none hover:bg-surface-secondary data-[hovered=true]:bg-surface-secondary"
              : "h-11 min-h-11 min-w-0 overflow-hidden pe-7 rounded-lg!"
          }
        >
          <Select.Value
            className={
              header
                ? "min-w-0 flex-1 truncate text-left text-sm font-medium sm:text-[15px]"
                : "min-w-0 flex-1 truncate text-left text-sm"
            }
          />
          <Select.Indicator className="shrink-0 text-muted" />
        </Select.Trigger>
        <Select.Popover
          className="z-[80] max-h-80 w-max min-w-64! max-w-md! rounded-lg! bg-overlay shadow-[var(--overlay-shadow)]"
          placement="bottom start"
        >
          <ListBox>
            {includeAll ? (
              <ListBox.Item id={ALL} className={itemClass} textValue="All campaigns">
                <span className="campaign-select-option-label" title="All campaigns">All campaigns</span>
                <ListBox.ItemIndicator className="shrink-0" />
              </ListBox.Item>
            ) : null}
            {campaigns.map((item) => (
              <ListBox.Item key={item.id} id={item.id} className={itemClass} textValue={item.name}>
                <span className="campaign-select-option-label" title={item.name}>{item.name}</span>
                <ListBox.ItemIndicator className="shrink-0" />
              </ListBox.Item>
            ))}
          </ListBox>
        </Select.Popover>
      </Select>
    </div>
  );
}
