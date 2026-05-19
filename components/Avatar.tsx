import { hashColor, initials } from "@/lib/utils";

type Props = {
  name: string;
  id: string;
  size?: "sm" | "md" | "lg";
};

const sizes = {
  sm: "size-7 text-xs",
  md: "size-9 text-body-sm",
  lg: "size-12 text-body",
};

export function Avatar({ name, id, size = "md" }: Props) {
  return (
    <div
      className={`${sizes[size]} rounded-full flex items-center justify-center font-semibold text-white shrink-0`}
      style={{ backgroundColor: hashColor(id) }}
      title={name}
    >
      {initials(name)}
    </div>
  );
}
