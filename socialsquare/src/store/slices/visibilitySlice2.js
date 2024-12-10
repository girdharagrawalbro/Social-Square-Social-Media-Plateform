import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  isVisible2: false,
};

export const visibilitySlice = createSlice({
  name: 'visibility2',
  initialState,
  reducers: {
    showComponent2: (state) => {
      state.isVisible2 = true;
      state.isVisible3 = false;
    },
    hideComponent2: (state) => {
      state.isVisible2 = false;
    },
  },
});

export const { showComponent2, hideComponent2 } = visibilitySlice.actions;

export default visibilitySlice.reducer;
