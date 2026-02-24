import { useState, useMemo } from "react";
import { Eye, EyeOff, Check, X } from "lucide-react";

interface PasswordInputProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  showStrength?: boolean;
  showRules?: boolean;
  autoComplete?: string;
  required?: boolean;
}

interface PasswordStrength {
  score: number;
  label: string;
  color: string;
}

function calculateStrength(password: string): PasswordStrength {
  let score = 0;
  
  if (!password) return { score: 0, label: "", color: "var(--text-muted)" };
  
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[a-z]/.test(password)) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[!@#$%^&*\-_=+\[\]{}|;:,.<>?]/.test(password)) score++;
  
  if (score <= 1) return { score: 1, label: "Weak", color: "var(--red)" };
  if (score <= 2) return { score: 2, label: "Fair", color: "var(--orange)" };
  if (score <= 4) return { score: 3, label: "Good", color: "var(--gold)" };
  return { score: 4, label: "Strong", color: "var(--green)" };
}

function checkRule(password: string, rule: "length" | "uppercase" | "lowercase" | "digit" | "special"): boolean {
  switch (rule) {
    case "length":
      return password.length >= 8;
    case "uppercase":
      return /[A-Z]/.test(password);
    case "lowercase":
      return /[a-z]/.test(password);
    case "digit":
      return /\d/.test(password);
    case "special":
      return /[!@#$%^&*\-_=+\[\]{}|;:,.<>?]/.test(password);
  }
}

const RULES = [
  { id: "length", label: "At least 8 characters" },
  { id: "uppercase", label: "Uppercase letter" },
  { id: "lowercase", label: "Lowercase letter" },
  { id: "digit", label: "Number" },
  { id: "special", label: "Special character" },
] as const;

export default function PasswordInput({
  value,
  onChange,
  label = "Password",
  placeholder = "",
  showStrength = false,
  showRules = false,
  autoComplete = "off",
  required = false,
}: PasswordInputProps) {
  const [showPassword, setShowPassword] = useState(false);
  
  const strength = useMemo(() => calculateStrength(value), [value]);
  const ruleStates = useMemo(() => {
    return RULES.map(rule => ({
      id: rule.id,
      label: rule.label,
      met: checkRule(value, rule.id as typeof RULES[number]["id"]),
    }));
  }, [value]);
  
  const allRulesMet = ruleStates.every(r => r.met);

  return (
    <div>
      {label && (
        <label className="duo-label">
          {label}
          {required && <span style={{ color: "var(--red)" }}>*</span>}
        </label>
      )}
      
      <div style={{ position: "relative" }}>
        <input
          className="duo-input w-full"
          type={showPassword ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          required={required}
          autoComplete={autoComplete}
        />
        <button
          type="button"
          onClick={() => setShowPassword(!showPassword)}
          title={showPassword ? "Hide password" : "Show password"}
          aria-label={showPassword ? "Hide password" : "Show password"}
          className="shrink-0"
          style={{
            position: "absolute",
            right: "12px",
            top: "50%",
            transform: "translateY(-50%)",
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "var(--text-muted)",
            padding: "4px 8px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>

      {showStrength && (
        <div style={{ marginTop: "12px" }}>
          <div style={{ display: "flex", gap: "4px", marginBottom: "8px" }}>
            {[1, 2, 3, 4].map((segment) => (
              <div
                key={segment}
                style={{
                  flex: 1,
                  height: "4px",
                  borderRadius: "2px",
                  backgroundColor:
                    segment <= strength.score
                      ? strength.color
                      : "var(--surface-bg)",
                }}
              />
            ))}
          </div>
          {strength.label && (
            <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
              <span
                style={{
                  fontSize: "12px",
                  fontWeight: 700,
                  color: strength.color,
                }}
              >
                {strength.label}
              </span>
            </div>
          )}
        </div>
      )}

      {showRules && (
        <div style={{ marginTop: "12px", display: "flex", flexDirection: "column", gap: "8px" }}>
          {ruleStates.map((rule) => (
            <div
              key={rule.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                fontSize: "12px",
                fontWeight: 600,
                color: rule.met ? "var(--green)" : "var(--text-muted)",
              }}
            >
              {rule.met ? (
                <Check size={14} />
              ) : (
                <X size={14} />
              )}
              {rule.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
