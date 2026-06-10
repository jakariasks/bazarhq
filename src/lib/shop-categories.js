// Each shop type has its own relevant categories
export const SHOP_TYPES = [
  'Fashion & Apparel',
  'Electronics',
  'Grocery & Food',
  'Beauty & Personal Care',
  'Home & Living',
  'Books & Stationery',
  'Handmade & Crafts',
  'Sports & Outdoors',
  'Other',
]

export const CATEGORIES_BY_TYPE = {
  'Fashion & Apparel': [
    'Men', 'Women', 'Kids', 'Baby',
    'Tops & T-Shirts', 'Shirts', 'Pants & Jeans', 'Dresses', 'Saree & Salwar',
    'Panjabi & Kurta', 'Activewear', 'Undergarments', 'Socks',
    'Shoes', 'Sandals', 'Boots', 'Sneakers',
    'Bags', 'Handbags', 'Backpacks', 'Wallets',
    'Accessories', 'Belts', 'Hats & Caps', 'Scarves',
    'Jewelry', 'Watches', 'Sunglasses', 'Ethnic Wear', 'Winter Wear',
  ],
  'Electronics': [
    'Mobile Phones', 'Phone Cases & Covers', 'Chargers & Cables',
    'Earphones & Headphones', 'Speakers', 'Power Banks',
    'Laptops', 'Laptop Accessories', 'Tablets', 'Keyboards & Mouse',
    'Smart Watches', 'Smart Home', 'Cameras', 'Camera Accessories',
    'TV & Displays', 'Gaming', 'PC Components', 'Networking',
    'Printers', 'USB & Storage', 'Other Electronics',
  ],
  'Grocery & Food': [
    'Rice & Grains', 'Flour & Bread', 'Oil & Ghee', 'Spices & Masala',
    'Dals & Pulses', 'Salt, Sugar & More', 'Tea & Coffee', 'Milk & Dairy',
    'Snacks & Chips', 'Biscuits & Cookies', 'Chocolate & Candy',
    'Cold Drinks & Juices', 'Water & Energy Drinks',
    'Frozen Foods', 'Instant Noodles', 'Sauces & Condiments',
    'Baby Food', 'Organic & Health Foods', 'Dry Fruits & Nuts',
    'Misti & Sweets', 'Bakery', 'Seafood', 'Meat & Poultry',
    'Vegetables', 'Fruits',
  ],
  'Beauty & Personal Care': [
    'Skincare', 'Face Wash', 'Moisturizer', 'Sunscreen', 'Serum & Toner',
    'Face Mask', 'Lip Care',
    'Makeup', 'Foundation', 'Lipstick', 'Eye Makeup', 'Nail Polish',
    'Haircare', 'Shampoo & Conditioner', 'Hair Oil', 'Hair Color',
    'Body Care', 'Body Lotion', 'Soap & Body Wash', 'Deodorant',
    'Men\'s Grooming', 'Shaving', 'Beard Care',
    'Perfume & Fragrance', 'Baby Care', 'Oral Care', 'Feminine Hygiene',
  ],
  'Home & Living': [
    'Bedroom', 'Bedsheets & Pillows', 'Blankets & Quilts',
    'Kitchen', 'Cookware', 'Cutlery', 'Kitchen Storage', 'Appliances',
    'Bathroom', 'Towels', 'Bathroom Accessories',
    'Living Room', 'Sofa & Chairs', 'Tables', 'Curtains & Blinds',
    'Storage & Organization', 'Cleaning Supplies',
    'Lighting', 'Wall Decor', 'Plants & Pots',
    'Furniture', 'Outdoor', 'Tools & Hardware', 'Safety & Security',
  ],
  'Books & Stationery': [
    'Fiction', 'Non-fiction', 'Islamic Books', 'Educational Books',
    'Children\'s Books', 'Comics & Manga', 'Academic Textbooks',
    'Notebooks & Journals', 'Pens & Pencils', 'Art Supplies',
    'Office Stationery', 'Craft Supplies', 'Gift Wrapping',
    'Calendars & Planners', 'Maps & Posters', 'Magazines',
  ],
  'Handmade & Crafts': [
    'Handmade Jewelry', 'Handmade Bags', 'Handmade Clothing',
    'Nakshi Kantha', 'Jamdani', 'Muslin',
    'Home Decor', 'Candles', 'Pottery & Ceramics',
    'Wall Art', 'Paintings', 'Sculptures',
    'Greeting Cards', 'Gift Items', 'Eco-friendly Products',
    'Bamboo & Cane', 'Leather Goods', 'Wooden Crafts',
    'Embroidery', 'Crochet & Knitting', 'Custom Orders',
  ],
  'Sports & Outdoors': [
    'Cricket', 'Football', 'Badminton', 'Table Tennis', 'Chess',
    'Gym Equipment', 'Dumbbells & Weights', 'Yoga & Fitness',
    'Cycling', 'Running & Walking', 'Swimming',
    'Outdoor & Camping', 'Fishing', 'Hunting',
    'Sports Clothing', 'Sports Shoes', 'Water Bottles',
    'Supplements & Nutrition', 'Protective Gear',
  ],
  'Other': [
    'General', 'Miscellaneous', 'New Arrivals', 'Best Sellers',
    'Sale & Offers', 'Custom Products', 'Services',
  ],
}

// Get categories for a given shop type
export function getCategoriesForType(shopType) {
  return CATEGORIES_BY_TYPE[shopType] ?? CATEGORIES_BY_TYPE['Other']
}

// Get all unique categories (for search/filter)
export function getAllCategories() {
  return [...new Set(Object.values(CATEGORIES_BY_TYPE).flat())]
}
