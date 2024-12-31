import React, { useState } from "react";
const Notification = ({ message, name }) => {
  const [show, setShow] = useState(false);

  React.useEffect(() => {
    setTimeout(() => setShow(true), 10); // Trigger transition
  }, []);

  return (
    <div className={`notification border rounded-pill py-2 px-3 bg-light d-flex align-items-center justify-content-center gap-2 ${show ? "show" : ""}`}>
      <img src="https://media.istockphoto.com/id/1957053641/vector/cute-kawaii-robot-character-friendly-chat-bot-assistant-for-online-applications-cartoon.jpg?s=612x612&w=0&k=20&c=Uf7lcu3I_ZNQvjBWxlFenRX7FuG_PKVJ4y1Y11aTZUc=" alt="" className="logo" />
      <b>
        {name} :
      </b>
      {message}
    </div>
  );
};

export default Notification