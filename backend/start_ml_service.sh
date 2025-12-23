#!/bin/bash
cd /Users/usmanqazi/creatorhub-backend/python_ml_service
python main.py > /tmp/python_ml_service.log 2>&1 &
echo $! > /tmp/python_ml_service.pid
echo "Python ML Service started (PID: $(cat /tmp/python_ml_service.pid))"
echo "Logs: /tmp/python_ml_service.log"
sleep 5
tail -30 /tmp/python_ml_service.log

