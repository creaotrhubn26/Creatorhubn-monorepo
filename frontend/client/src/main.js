import React from 'react';
import ReactDOM from 'react-dom/client';

function SimpleApp() {
  return React.createElement('div', { style: { padding: '20px' } }, 
    React.createElement('h1', null, 'Simple React App Working!'),
    React.createElement('p', null, 'If you see this, React is working properly.'),
    React.createElement('p', null, 'This confirms that the basic React setup is functional.')
  );
}

const root = ReactDOM.createRoot(
  document.getElementById('root')
);

root.render(
  React.createElement(React.StrictMode, null, 
    React.createElement(SimpleApp, null)
  )
);