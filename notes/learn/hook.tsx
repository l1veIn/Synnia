import { useState, useEffect, useMemo, useCallback } from 'react';

/**
 * A custom hook to handle the "Infrastructure Features" of a node.
 * Integrates Rules, Computed Fields, and UI Hints.
 * * @param {Object} initialData - The 'data' object from the JSON node
 * @returns {Object} { values, errors, handleChange, computedValues }
 */
export const useNodeLogic = (initialData) => {
  // Store the raw values of properties
  const [properties, setProperties] = useState(() => {
    const init = {};
    Object.keys(initialData.properties).forEach(key => {
      // Handle standard values vs computed definitions
      if (initialData.properties[key].type !== 'computed') {
        init[key] = initialData.properties[key].value;
      }
    });
    return init;
  });

  const [errors, setErrors] = useState({});

  // 1. Feature: Computed Fields Implementation
  // Dynamically calculate values based on 'expression' and 'dependencies'
  const computedValues = useMemo(() => {
    const computed = {};
    
    Object.keys(initialData.properties).forEach(key => {
      const fieldDef = initialData.properties[key];
      
      if (fieldDef.type === 'computed') {
        try {
          // Identify dependencies (e.g., width, height)
          const deps = fieldDef.dependencies || [];
          const context = {};
          
          // Create a context object with current property values
          deps.forEach(dep => {
            context[dep] = properties[dep];
          });

          // Hacky but effective for local JSON: Create a function from string expression
          // In production, use a safe parser like 'mathjs' or a restricted evaluator
          // This represents: "this.width / this.height" -> function(width, height)
          const func = new Function(...deps, `return ${fieldDef.expression.replace(/this\./g, '')}`);
          
          computed[key] = func(...deps.map(d => properties[d]));
        } catch (e) {
          console.warn(`Error computing field ${key}:`, e);
          computed[key] = "Error";
        }
      }
    });
    return computed;
  }, [properties, initialData.properties]);

  // 2. Feature: Rules / Validation Implementation
  const validateField = useCallback((key, value) => {
    const fieldDef = initialData.properties[key];
    if (!fieldDef || !fieldDef.rules) return null;

    for (const rule of fieldDef.rules) {
      // Regex Pattern Rule
      if (rule.pattern) {
        const regex = new RegExp(rule.pattern);
        if (!regex.test(String(value))) {
          return rule.message || "Invalid format";
        }
      }
      
      // Max Length Rule
      if (rule.max_length && String(value).length > rule.max_length) {
        return rule.message || `Max length is ${rule.max_length}`;
      }
      
      // Max Items (Array) Rule
      if (rule.max_items && Array.isArray(value) && value.length > rule.max_items) {
        return rule.message || `Max ${rule.max_items} items allowed`;
      }
    }
    return null;
  }, [initialData.properties]);

  // Handler for inputs
  const handleChange = (key, newValue) => {
    // Check locks (Feature 5: Permissions)
    const fieldDef = initialData.properties[key];
    if (fieldDef?.ui_hints?.readonly) {
        console.warn("Field is readonly");
        return;
    }

    setProperties(prev => ({ ...prev, [key]: newValue }));
    
    // Validate on change
    const error = validateField(key, newValue);
    setErrors(prev => ({
      ...prev,
      [key]: error
    }));
  };

  return {
    values: { ...properties, ...computedValues }, // Merge raw and computed
    errors,
    handleChange,
    // Helper to get UI hints for rendering (Feature 2: UI Hints)
    getUIHints: (key) => initialData.properties[key]?.ui_hints || {}
  };
};