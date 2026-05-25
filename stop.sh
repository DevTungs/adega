#!/bin/bash
echo "Parando Delivery System..."
pkill -f "node start.js" 2>/dev/null || true
pkill -f "node.*backend" 2>/dev/null || true
pkill -f "node.*frontend" 2>/dev/null || true
echo "Sistema parado."
