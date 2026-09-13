import { ListBox, Select } from "@heroui/react";
import type { PublicCampaign } from "../../shared/contracts";

const ALL = "__all__";

const itemClass =
  "rounded-lg! text-sm data-[hovered=true]:bg-default data-[selected=true]:bg-accent-soft data-[selected=true]:text-accent-soft-foreground data-[selected=true]:data-[hovered=true]:bg-accent-soft";

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

  return (
    <div className={className} title={title}>
      <Select
        id={id}
        aria-label={ariaLabel}
        fullWidth
        isDisabled={isDisabled}
        placeholder={includeAll ? "All campaigns" : "Campaign"}
        value={selected || null}
        variant="secondary"
        onChange={(next) => {
          if (typeof next !== "string") return;
          onChange(next === ALL ? "" : next);
        }}
      >
        <Select.Trigger
          className={
            header
              ? "h-9 min-h-9 min-w-0 justify-start border-0 bg-transparent px-2 shadow-none hover:bg-surface-secondary data-[hovered=true]:bg-surface-secondary"
              : "h-11 min-h-11 rounded-lg!"
          }
        >
          <Select.Value
            className={
              header
                ? "min-w-0 flex-1 truncate text-left text-sm font-medium sm:text-[15px]"
                : "min-w-0 flex-1 truncate text-left text-sm"
            }
          />
          <Select.Indicator className="text-muted" />
        </Select.Trigger>
        <Select.Popover className="z-[80] max-h-80 rounded-lg!" placement="bottom start">
          <ListBox>
            {includeAll ? (
              <ListBox.Item id={ALL} className={itemClass} textValue="All campaigns">
                All campaigns
                <ListBox.ItemIndicator />
              </ListBox.Item>
            ) : null}
            {campaigns.map((item) => (
              <ListBox.Item key={item.id} id={item.id} className={itemClass} textValue={item.name}>
                {item.name}
                <ListBox.ItemIndicator />
              </ListBox.Item>
            ))}
          </ListBox>
        </Select.Popover>
      </Select>
    </div>
  );
}
