// hooks/useForm.js
import { useState } from 'react';

const useForm = (initialState) => {
  const [form, setForm] = useState(initialState);

  const handleInputChange = (event) => {
    const { name, value } = event.target;
    console.log("Updating form field:", name, "Value:", value); 
    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  return [form, handleInputChange, setForm];
};

export default useForm;
