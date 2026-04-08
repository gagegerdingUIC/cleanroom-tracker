import { nowCST } from "../utils/datetime";

interface DateTimeInputProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  required?: boolean;
  className?: string;
}

const inputClass =
  "w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";

export default function DateTimeInput({
  value,
  onChange,
  label,
  required,
  className,
}: DateTimeInputProps) {
  return (
    <div className={className}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label}
          {required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
      )}
      <div className="flex gap-1">
        <input
          className={inputClass}
          type="datetime-local"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
        />
        <button
          type="button"
          onClick={() => onChange(nowCST())}
          className="px-2 py-1 text-xs border rounded bg-gray-50 text-gray-600 hover:bg-gray-100 whitespace-nowrap flex-shrink-0"
          title="Set to current time (CST)"
        >
          Now
        </button>
      </div>
    </div>
  );
}
