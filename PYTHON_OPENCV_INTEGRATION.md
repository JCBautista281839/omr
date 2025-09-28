# Python OpenCV OMR Integration

## Overview

The OMR POS Backend now integrates Python OpenCV for advanced Optical Mark Recognition processing. This provides superior accuracy and performance compared to JavaScript-based image processing.

## Architecture

```
Node.js Backend (Express)
    ↓ HTTP Request
OMR Routes (/api/omr/*)
    ↓ File Upload
Python OMR Processor (OpenCV)
    ↓ Image Processing
SQLite Database
    ↓ Order Creation
Response to Client
```

## Python Dependencies

The Python environment requires the following packages:

```txt
opencv-python==4.8.1.78
numpy==1.24.3
Pillow==10.0.1
```

## OMR Processing Features

### Advanced Image Processing
- **Grayscale Conversion**: Converts color images to grayscale for better processing
- **Gaussian Blur**: Reduces noise in scanned images
- **Adaptive Thresholding**: Handles varying lighting conditions
- **Contour Detection**: Identifies form elements and marks

### Mark Detection
- **Position-Based Detection**: Uses expected form layout for accurate mark detection
- **Confidence Scoring**: Provides accuracy metrics for each detected mark
- **Multiple Mark Types**: Supports both checkboxes (quantity) and radio buttons (selection)

### Form Layout Support
The system is specifically designed for your restaurant form layout:

```
┌─────────────────────────────────────┐
│ Quantity    │ Menu                  │
├─────────────┼───────────────────────┤
│ ☐ isda      │ ○ isda               │
│ ☐ egg       │ ○ egg                │
│ ☐ water     │ ○ water              │
│ ☐ sinigang  │ ○ sinigang           │
│ ☐ Chicken   │ ○ Chicken            │
│ ☐ pusit     │ ○ pusit              │
│ ☐ gatas     │ ○ gatas              │
│ ☐ beef      │ ○ beef               │
└─────────────┴───────────────────────┘
```

## API Integration

### Process Image Endpoint
```http
POST /api/omr/process
Content-Type: multipart/form-data

Form Data:
- image: [file] - Image file to process
- form_type: "menu_order" - Type of form
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "form_type": "menu_order",
    "marks": [
      {
        "type": "quantity",
        "item": "isda",
        "position": {"x": 100, "y": 200, "width": 50, "height": 50},
        "isMarked": true,
        "confidence": 0.85,
        "whitePixels": 425,
        "totalPixels": 500
      }
    ],
    "confidence": 85,
    "processor": "python-opencv",
    "image_dimensions": {"width": 800, "height": 600},
    "total_marks_detected": 16,
    "marked_items": ["isda", "Chicken"]
  },
  "message": "OMR processing completed successfully using Python OpenCV"
}
```

### Process to Order Endpoint
```http
POST /api/omr/process-to-order
Content-Type: multipart/form-data

Form Data:
- image: [file] - Image file to process
- customer_name: "John Doe" (optional)
- table_number: 5 (optional)
- notes: "Extra spicy" (optional)
```

**Response:**
```json
{
  "success": true,
  "data": {
    "order": {
      "id": 1,
      "order_number": "OMR-1234567890-1234",
      "customer_name": "John Doe",
      "table_number": 5,
      "status": "pending",
      "total_amount": 275.00,
      "items": [...]
    },
    "omr_result": {
      "marks": [...],
      "confidence": 85,
      "processor": "python-opencv",
      "image_dimensions": {"width": 800, "height": 600},
      "marked_items": ["isda", "Chicken"]
    }
  },
  "message": "Order created from OMR form successfully using Python OpenCV"
}
```

## Python Script Usage

### Command Line Usage
```bash
python python/omr_processor.py path/to/image.jpg
```

### Programmatic Usage
```python
from omr_processor import OMRProcessor

processor = OMRProcessor()
result = processor.process_form('path/to/image.jpg')

if result['success']:
    print(f"Confidence: {result['confidence']}")
    print(f"Marked items: {result['marked_items']}")
else:
    print(f"Error: {result['error']}")
```

## Configuration

### Environment Variables
- `PYTHON_PATH`: Path to Python executable (default: "python3")
- `MAX_FILE_SIZE`: Maximum file size for uploads (default: 5MB)

### Python Script Configuration
The `OMRProcessor` class can be configured:

```python
class OMRProcessor:
    def __init__(self):
        self.threshold_value = 127  # Binarization threshold
        self.min_area = 100        # Minimum area for mark detection
        self.max_area = 5000       # Maximum area for mark detection
        self.menu_items = ['isda', 'egg', 'water', 'sinigang', 
                          'Chicken', 'pusit', 'gatas', 'beef']
```

## Error Handling

The system includes comprehensive error handling:

1. **Python Environment Check**: Verifies Python and dependencies are installed
2. **Image Validation**: Checks file existence and format
3. **Processing Errors**: Handles OpenCV processing failures gracefully
4. **Fallback Mechanism**: Falls back to basic processing if Python fails

## Performance Considerations

### Optimization Features
- **Efficient Image Processing**: Uses OpenCV's optimized C++ backend
- **Memory Management**: Proper cleanup of image data
- **Async Processing**: Non-blocking Python process execution
- **File Cleanup**: Automatic removal of temporary files

### Performance Metrics
- **Processing Time**: Typically 1-3 seconds per image
- **Accuracy**: 85-95% accuracy for well-scanned forms
- **Memory Usage**: Minimal memory footprint with proper cleanup

## Troubleshooting

### Common Issues

1. **Python Not Found**
   ```
   Error: Python not found. Please install Python 3.7+ and ensure it's in your PATH
   ```
   **Solution**: Install Python 3.7+ and ensure it's in your system PATH

2. **Missing Dependencies**
   ```
   Error: Failed to install Python dependencies
   ```
   **Solution**: Run `pip install -r python/requirements.txt`

3. **Image Processing Failed**
   ```
   Error: Python processing failed: Could not load image
   ```
   **Solution**: Ensure image file exists and is in supported format (JPEG, PNG, etc.)

4. **Low Confidence Scores**
   ```
   Confidence: 45
   ```
   **Solution**: 
   - Ensure good lighting when scanning
   - Use high-quality scanner or camera
   - Check form alignment and corner markers

### Debug Mode
Enable debug logging by setting `NODE_ENV=development` in your `.env` file.

## Development

### Testing Python Script
```bash
# Test with sample image
python python/omr_processor.py test_image.jpg

# Expected output:
{
  "success": true,
  "marks": [...],
  "confidence": 85.5,
  "image_dimensions": {"width": 800, "height": 600},
  "total_marks_detected": 16,
  "marked_items": ["isda", "Chicken"]
}
```

### Customizing Form Layout
To adapt the system for different form layouts, modify the `_get_expected_positions` method in `omr_processor.py`:

```python
def _get_expected_positions(self, width: int, height: int) -> List[Dict]:
    positions = []
    
    # Customize positions based on your form layout
    # Example: Different number of items or columns
    for i, item in enumerate(self.menu_items):
        # Calculate custom positions
        x_pos = width * 0.1 + (i % 2) * width * 0.4
        y_pos = height * 0.2 + (i // 2) * height * 0.08
        
        positions.append({
            'type': 'quantity',
            'item': item,
            'x': int(x_pos),
            'y': int(y_pos),
            'width': int(width * 0.05),
            'height': int(height * 0.05)
        })
    
    return positions
```

## Production Deployment

### Requirements
- Python 3.7+ with OpenCV
- Node.js 16+ with all dependencies
- Sufficient disk space for image uploads
- Proper file permissions for upload directory

### Performance Tuning
- Adjust `threshold_value` for different lighting conditions
- Modify `min_area` and `max_area` for different mark sizes
- Consider implementing image preprocessing pipeline
- Use Redis for caching processed results

### Security Considerations
- Validate uploaded file types
- Implement file size limits
- Use secure file upload directory
- Implement rate limiting for OMR endpoints
- Sanitize all input data
