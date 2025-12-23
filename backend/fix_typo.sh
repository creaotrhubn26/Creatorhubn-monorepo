#!/bin/bash
# Fix the typo in eye_bag_removal_service.py
cd /Users/usmanqazi/creatorhub-backend/python_ml_service/services
sed -i '' 's/np\.frombuffer/np.frombuffer/g' eye_bag_removal_service.py
echo "✅ Fixed typo: np.frombuffer → np.frombuffer"

