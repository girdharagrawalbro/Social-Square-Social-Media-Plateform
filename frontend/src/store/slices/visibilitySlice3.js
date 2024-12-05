import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  isVisible: false,
  id: null, // To track which component trigger`ed visibility
};

export const visibilitySlice = createSlice({
  name: 'visibility3',
  initialState,
  reducers: {
    showComponent3: (state, action) => {
      state.isVisible3 = true;
      state.isVisible2 = false;
    },
    hideComponent3: (state) => {
      state.isVisible3 = false;
    },
  },
});

export const { showComponent3, hideComponent3 } = visibilitySlice.actions;

export default visibilitySlice.reducer;
