import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { showComponent, hideComponent } from './store/slices/visibilitySlice';

const Component = () => {
  const dispatch = useDispatch();
  const { isVisible, id } = useSelector((state) => state.visibility);

  const handleShow = () => {
    dispatch(showComponent('component-id'));
  };

  const handleHide = () => {
    dispatch(hideComponent());
  };

  return (
    <div>
      <button onClick={handleShow}>Show Component</button>
      <button onClick={handleHide}>Hide Component</button>
      {isVisible && <div>Component is visible with ID: {id}</div>}
    </div>
  );
};

export default Component;
