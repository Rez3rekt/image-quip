// Validation utilities for form fields and user input
import { useState, useCallback } from 'react';

export const validation = {
  // Email validation
  email: {
    validate: (email) => {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return emailRegex.test(email);
    },
    message: 'Please enter a valid email address',
  },

  // Username validation
  username: {
    validate: (username) => {
      // 3-20 characters, alphanumeric and underscores only
      const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
      return usernameRegex.test(username);
    },
    message: 'Username must be 3-20 characters, letters, numbers, and underscores only',
  },

  // Password validation
  password: {
    validate: (password) => {
      // Minimum 6 characters, at least one letter and one number
      const passwordRegex = /^(?=.*[a-zA-Z])(?=.*\d).{6,}$/;
      return passwordRegex.test(password);
    },
    message: 'Password must be at least 6 characters with at least one letter and one number',
  },

  // Nickname validation (for games)
  nickname: {
    validate: (nickname) => {
      // 1-12 characters, allow most characters but not just whitespace
      return nickname && nickname.trim().length >= 1 && nickname.trim().length <= 12;
    },
    message: 'Nickname must be 1-12 characters long',
  },

  // Game code validation
  gameCode: {
    validate: (code) => {
      // 5 uppercase letters/numbers
      const gameCodeRegex = /^[A-Z0-9]{5}$/;
      return gameCodeRegex.test(code);
    },
    message: 'Game code must be 5 uppercase letters or numbers',
  },

  // Deck name validation
  deckName: {
    validate: (name) => {
      // 1-30 characters, not just whitespace
      return name && name.trim().length >= 1 && name.trim().length <= 30;
    },
    message: 'Deck name must be 1-30 characters long',
  },

  // General required field validation
  required: {
    validate: (value) => {
      return value !== null && value !== undefined && value.toString().trim().length > 0;
    },
    message: 'This field is required',
  },

  // Password confirmation validation
  passwordConfirm: {
    validate: (password, confirmPassword) => {
      return password === confirmPassword;
    },
    message: 'Passwords do not match',
  },
};

// Helper function to validate multiple fields
export const validateForm = (fields) => {
  const errors = {};
  
  for (const [fieldName, fieldConfig] of Object.entries(fields)) {
    const { value, validations } = fieldConfig;
    
    for (const validationType of validations) {
      let isValid = false;
      let errorMessage = '';
      
      if (typeof validationType === 'string') {
        // Use predefined validation
        const validator = validation[validationType];
        if (validator) {
          isValid = validator.validate(value);
          errorMessage = validator.message;
        }
      } else if (typeof validationType === 'object') {
        // Custom validation with parameters
        const { type, params = [] } = validationType;
        const validator = validation[type];
        if (validator) {
          isValid = validator.validate(value, ...params);
          errorMessage = validator.message;
        }
      }
      
      if (!isValid) {
        errors[fieldName] = errorMessage;
        break; // Stop at first error for this field
      }
    }
  }
  
  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
};

// Real-time validation hook for React components
export const useValidation = (initialFields = {}) => {
  const [fields, setFields] = useState(initialFields);
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  
  const validateField = useCallback((fieldName, value, validations) => {
    const fieldErrors = {};
    
    for (const validationType of validations) {
      let isValid = false;
      let errorMessage = '';
      
      if (typeof validationType === 'string') {
        const validator = validation[validationType];
        if (validator) {
          isValid = validator.validate(value);
          errorMessage = validator.message;
        }
      } else if (typeof validationType === 'object') {
        const { type, params = [] } = validationType;
        const validator = validation[type];
        if (validator) {
          isValid = validator.validate(value, ...params);
          errorMessage = validator.message;
        }
      }
      
      if (!isValid) {
        fieldErrors[fieldName] = errorMessage;
        break;
      }
    }
    
    setErrors(prev => ({
      ...prev,
      [fieldName]: fieldErrors[fieldName] || '',
    }));
    
    return Object.keys(fieldErrors).length === 0;
  }, []);
  
  const updateField = useCallback((fieldName, value) => {
    setFields(prev => ({
      ...prev,
      [fieldName]: { ...prev[fieldName], value },
    }));
    
    // Validate if field has been touched
    if (touched[fieldName] && fields[fieldName]?.validations) {
      validateField(fieldName, value, fields[fieldName].validations);
    }
  }, [fields, touched, validateField]);
  
  const touchField = useCallback((fieldName) => {
    setTouched(prev => ({
      ...prev,
      [fieldName]: true,
    }));
    
    // Validate when field is touched
    if (fields[fieldName]) {
      validateField(fieldName, fields[fieldName].value, fields[fieldName].validations || []);
    }
  }, [fields, validateField]);
  
  const validateAll = useCallback(() => {
    const formValidation = validateForm(fields);
    setErrors(formValidation.errors);
    
    // Mark all fields as touched
    const allTouched = {};
    Object.keys(fields).forEach(key => {
      allTouched[key] = true;
    });
    setTouched(allTouched);
    
    return formValidation.isValid;
  }, [fields]);
  
  return {
    fields,
    errors,
    touched,
    updateField,
    touchField,
    validateAll,
    isValid: Object.keys(errors).length === 0,
  };
}; 