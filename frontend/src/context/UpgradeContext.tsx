import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";

interface UpgradeContextValue {
  showUpgrade: (featureMessage?: string) => void;
  hideUpgrade: () => void;
  isOpen: boolean;
  featureMessage: string | null;
}

const UpgradeContext = createContext<UpgradeContextValue>({
  showUpgrade: () => {},
  hideUpgrade: () => {},
  isOpen: false,
  featureMessage: null,
});

export function UpgradeProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [featureMessage, setFeatureMessage] = useState<string | null>(null);

  const showUpgrade = useCallback((msg?: string) => {
    setFeatureMessage(msg ?? null);
    setIsOpen(true);
  }, []);

  const hideUpgrade = useCallback(() => {
    setIsOpen(false);
    setFeatureMessage(null);
  }, []);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ message?: string }>).detail;
      showUpgrade(detail?.message ?? undefined);
    };
    window.addEventListener("lawflow:upgrade-prompt", handler);
    return () => window.removeEventListener("lawflow:upgrade-prompt", handler);
  }, [showUpgrade]);

  return (
    <UpgradeContext.Provider value={{ showUpgrade, hideUpgrade, isOpen, featureMessage }}>
      {children}
    </UpgradeContext.Provider>
  );
}

export function useUpgrade() {
  return useContext(UpgradeContext);
}
