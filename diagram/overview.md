```mermaid
sequenceDiagram
    WebSocketClient_html->>WebSocketServer: connect
    WebSocketClient_html->>WebSocketServer: /config
    WebSocketServer->>dummyTcpEchoServer: new tcp client connect
    WebSocketClient_html->>WebSocketServer: /data (modbus request)
    WebSocketServer->>dummyTcpEchoServer: request modbus data
    dummyTcpEchoServer-->>WebSocketServer: response modbus data
    WebSocketServer-->>WebSocketClient_html: /data (modbus response)
    WebSocketClient_html->>WebSocketServer: /event
```