import React from 'react';
import { renderToString } from 'react-dom/server';
import { Group, Panel, Separator } from 'react-resizable-panels';

try {
  const html = renderToString(
    React.createElement(Group, { orientation: "horizontal" }, 
      React.createElement(Panel, { defaultSize: 20 }, "Left"),
      React.createElement(Separator),
      React.createElement(Panel, { defaultSize: 80 }, "Right")
    )
  );
  console.log("HTML:", html);
} catch (e) {
  console.log("ERROR:", e);
}
