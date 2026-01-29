// Utility functions for the workflow management system

// Error handling utilities
export function formatError(error) {
  if (typeof error === 'string') return error;
  if (error?.message) return error.message;
  if (error?.error) return error.error;
  return 'Đã xảy ra lỗi không xác định';
}

export function handleAsyncError(asyncFn) {
  return async (...args) => {
    try {
      return await asyncFn(...args);
    } catch (error) {
      console.error('Async operation failed:', error);
      throw error;
    }
  };
}

// Debounce utility for search/input
export function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Validation utilities
export function validateWorkflow(data) {
  const errors = [];
  
  // Name validation
  if (!data.name?.trim()) {
    errors.push('Tên workflow không được để trống');
  } else if (data.name.trim().length < 3) {
    errors.push('Tên workflow phải có ít nhất 3 ký tự');
  } else if (data.name.trim().length > 100) {
    errors.push('Tên workflow không được quá 100 ký tự');
  } else if (!/^[a-zA-Z0-9\s\-_àáâãéêíóôõúăđĩũơưạảấầẩẫậắằẳẵặếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹ]+$/.test(data.name.trim())) {
    errors.push('Tên workflow chứa ký tự không hợp lệ');
  }
  
  // Description validation
  if (data.description && data.description.length > 500) {
    errors.push('Mô tả không được quá 500 ký tự');
  }
  
  // Version validation
  if (!Number.isInteger(data.version) || data.version < 1 || data.version > 999) {
    errors.push('Version phải là số nguyên từ 1 đến 999');
  }
  
  return errors;
}

export function validateActivity(data) {
  const errors = [];
  
  // Name validation
  if (!data.name?.trim()) {
    errors.push('Tên activity không được để trống');
  } else if (data.name.trim().length < 2) {
    errors.push('Tên activity phải có ít nhất 2 ký tự');
  } else if (data.name.trim().length > 100) {
    errors.push('Tên activity không được quá 100 ký tự');
  }
  
  // Type validation
  if (!['user', 'role', 'department', 'group', 'service'].includes(data.type)) {
    errors.push('Loại activity không hợp lệ');
  }
  
  // Handler validation for service type
  if (data.type === 'service') {
    if (!data.handler?.trim()) {
      errors.push('Service activity phải có handler');
    } else if (data.handler.trim().length < 2 || data.handler.trim().length > 50) {
      errors.push('Handler phải có từ 2-50 ký tự');
    }
  }
  
  return errors;
}

export function validateTransition(data, activities = []) {
  const errors = [];
  
  // From activity validation
  if (!data.from_activity_id) {
    errors.push('Phải chọn activity nguồn');
  }
  
  // To activity validation  
  if (!data.to_activity_id) {
    errors.push('Phải chọn activity đích');
  }
  
  // Self-reference check
  if (data.from_activity_id === data.to_activity_id) {
    errors.push('Activity nguồn và đích không thể giống nhau');
  }
  
  // Condition validation
  if (!data.condition?.trim()) {
    errors.push('Điều kiện không được để trống');
  } else if (data.condition.trim().length > 200) {
    errors.push('Điều kiện không được quá 200 ký tự');
  }
  
  // Priority validation
  if (data.priority !== undefined && data.priority !== '' && data.priority !== null) {
    if (!Number.isInteger(Number(data.priority)) || Number(data.priority) < 0 || Number(data.priority) > 999) {
      errors.push('Priority phải là số nguyên từ 0 đến 999');
    }
  }
  
  // Activity existence validation
  if (activities.length > 0) {
    const fromExists = activities.some(a => a.id === Number(data.from_activity_id));
    const toExists = activities.some(a => a.id === Number(data.to_activity_id));
    
    if (!fromExists) {
      errors.push('Activity nguồn không tồn tại');
    }
    if (!toExists) {
      errors.push('Activity đích không tồn tại');
    }
  }
  
  return errors;
}

// Local storage utilities
export function saveToLocalStorage(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (error) {
    console.warn('Failed to save to localStorage:', error);
  }
}

export function loadFromLocalStorage(key, defaultValue = null) {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch (error) {
    console.warn('Failed to load from localStorage:', error);
    return defaultValue;
  }
}

// Date formatting utilities
export function formatDateTime(dateString) {
  if (!dateString) return '';
  try {
    return new Date(dateString).toLocaleString('vi-VN');
  } catch (error) {
    return dateString;
  }
}

export function formatDate(dateString) {
  if (!dateString) return '';
  try {
    return new Date(dateString).toLocaleDateString('vi-VN');
  } catch (error) {
    return dateString;
  }
}

// BPMN utilities
export function validateBpmnXml(xml) {
  if (!xml || typeof xml !== 'string') return false;
  return xml.trim().startsWith('<?xml') && xml.includes('<definitions');
}

export function extractBpmnInfo(xml) {
  if (!xml) return null;
  
  const hasProcess = xml.includes('<process') || xml.includes('process');
  const hasDiagram = xml.includes('<bpmndi:BPMNDiagram') || xml.includes('bpmndi:BPMNDiagram');
  const hasElements = xml.includes('<userTask') || xml.includes('<startEvent') || xml.includes('<endEvent');
  
  return {
    hasProcess,
    hasDiagram,
    hasElements,
    isValid: hasProcess && hasDiagram,
    length: xml.length
  };
}

// Performance utilities
export function measurePerformance(name, fn) {
  return async (...args) => {
    const startTime = performance.now();
    try {
      const result = await fn(...args);
      const endTime = performance.now();
      console.log(`${name} took ${endTime - startTime} milliseconds`);
      return result;
    } catch (error) {
      const endTime = performance.now();
      console.log(`${name} failed after ${endTime - startTime} milliseconds`, error);
      throw error;
    }
  };
}

// Array utilities
export function groupBy(array, key) {
  return array.reduce((result, item) => {
    const group = item[key];
    if (!result[group]) result[group] = [];
    result[group].push(item);
    return result;
  }, {});
}

export function sortBy(array, key, ascending = true) {
  return [...array].sort((a, b) => {
    const aVal = a[key];
    const bVal = b[key];
    if (aVal < bVal) return ascending ? -1 : 1;
    if (aVal > bVal) return ascending ? 1 : -1;
    return 0;
  });
}