import { configureStore } from '@reduxjs/toolkit';
import visibilityReducer from './slices/visibilitySlice';

export const store = configureStore({
  reducer: {
    visibility: visibilityReducer,
  },
});
