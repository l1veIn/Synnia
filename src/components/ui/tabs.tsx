
import * as React from "react"
import { cn } from "@/lib/utils"

interface TabsProps {
  defaultValue?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  children: React.ReactNode;
  className?: string;
}

interface TabsListProps {
  children: React.ReactNode;
  className?: string;
}

interface TabsTriggerProps {
  value: string;
  children: React.ReactNode;
  className?: string;
}

interface TabsContentProps {
  value: string;
  children: React.ReactNode;
  className?: string;
}

const TabsContext = React.createContext<{
  value: string;
  setValue: (value: string) => void;
}>({
  value: '',
  setValue: () => {},
});

const Tabs: React.FC<TabsProps> = ({ 
  defaultValue = '', 
  value: controlledValue, 
  onValueChange, 
  children, 
  className 
}) => {
  const [internalValue, setInternalValue] = React.useState(defaultValue);
  
  const value = controlledValue !== undefined ? controlledValue : internalValue;
  
  const setValue = React.useCallback((newValue: string) => {
    if (controlledValue === undefined) {
      setInternalValue(newValue);
    }
    onValueChange?.(newValue);
  }, [controlledValue, onValueChange]);

  return (
    <TabsContext.Provider value={{ value, setValue }}>
      <div className={cn("", className)}>
        {children}
      </div>
    </TabsContext.Provider>
  );
};

const TabsList: React.FC<TabsListProps> = ({ children, className }) => (
  <div
    className={cn(
      "inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground",
      className
    )}
  >
    {children}
  </div>
);

const TabsTrigger: React.FC<TabsTriggerProps> = ({ value: triggerValue, children, className }) => {
  const { value, setValue } = React.useContext(TabsContext);
  const isActive = value === triggerValue;
  
  return (
    <button
      onClick={() => setValue(triggerValue)}
      className={cn(
        "inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
        isActive ? "bg-background text-foreground shadow-sm" : "",
        className
      )}
    >
      {children}
    </button>
  );
};

const TabsContent: React.FC<TabsContentProps> = ({ value: contentValue, children, className }) => {
  const { value } = React.useContext(TabsContext);
  
  if (value !== contentValue) return null;
  
  return (
    <div
      className={cn(
        "mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        className
      )}
    >
      {children}
    </div>
  );
};

export { Tabs, TabsList, TabsTrigger, TabsContent }
