import csv
import json

def try_decode_file(file_path):
    """Пробуем разные кодировки для русского текста"""
    encodings_to_try = [
        'utf-8',
        'utf-8-sig',
        'windows-1251',
        'cp1251',
        'iso-8859-5',
        'koi8-r',
        'cp866',
        'mac_cyrillic'
    ]
    
    for encoding in encodings_to_try:
        try:
            with open(file_path, 'r', encoding=encoding) as f:
                # Читаем первые 3 строки для проверки
                lines = []
                for i in range(3):
                    line = f.readline()
                    if line:
                        lines.append(line)
                
                # Проверяем, что в строках есть кириллица
                test_text = ''.join(lines)
                # Ищем хотя бы одну русскую букву
                cyrillic_chars = set('абвгдеёжзийклмнопрстуфхцчшщъыьэюя')
                found_cyrillic = any(char in test_text.lower() for char in cyrillic_chars)
                
                if found_cyrillic and '�' not in test_text:
                    print(f"✅ Найдена рабочая кодировка: {encoding}")
                    print(f"   Пример строки: {lines[0][:50]}...")
                    return encoding
                    
        except UnicodeDecodeError:
            continue
        except Exception as e:
            continue
    
    print("❌ Не удалось определить кодировку автоматически")
    print("Попробуйте открыть файл в Notepad++ и сохранить как UTF-8")
    return None

def convert_okved_csv_to_json(input_file, output_file):
    """Конвертирует CSV ОКВЭД в JSON для JS"""
    
    print("🔧 Конвертация ОКВЭД CSV в JSON для JavaScript")
    print("=" * 50)
    
    # Определяем кодировку
    encoding = try_decode_file(input_file)
    if not encoding:
        return
    
    data = []
    
    try:
        with open(input_file, 'r', encoding=encoding) as f:
            # Пробуем определить разделитель
            first_line = f.readline()
            f.seek(0)  # Возвращаемся в начало
            
            if ';' in first_line:
                delimiter = ';'
            elif ',' in first_line and first_line.count(',') > 1:
                delimiter = ','
            else:
                # Если нет явных разделителей, пробуем табуляцию
                delimiter = '\t'
            
            print(f"📁 Используем разделитель: '{delimiter}'")
            
            reader = csv.reader(f, delimiter=delimiter, quotechar='"')
            
            processed_count = 0
            skipped_count = 0
            
            for i, row in enumerate(reader):
                # Пропускаем пустые строки
                if not any(row):
                    continue
                
                # Нормализуем строку (убираем лишние кавычки)
                row = [cell.strip().strip('"').strip("'") for cell in row]
                
                # В CSV должно быть минимум 3 колонки: раздел, код, название
                if len(row) < 3:
                    print(f"⚠️  Строка {i+1}: пропущена, недостаточно колонок: {row}")
                    skipped_count += 1
                    continue
                
                section = row[0]
                code = row[1]
                name = row[2]
                
                # Проверяем валидность
                if not code or code.isspace():
                    print(f"⚠️  Строка {i+1}: пропущена, пустой код")
                    skipped_count += 1
                    continue
                
                if not name or name.isspace():
                    print(f"⚠️  Строка {i+1}: пропущена, пустое название")
                    skipped_count += 1
                    continue
                
                # Определяем уровень иерархии
                if len(code) == 1 and code.isalpha():
                    level = 'section'  # Раздел (A, B, C...)
                elif '.' not in code:
                    if len(code) == 2 and code.isdigit():
                        level = 'class'    # Класс (01, 02...)
                    else:
                        level = 'unknown'
                elif code.count('.') == 1:
                    level = 'subclass' # Подкласс (01.1, 01.2...)
                elif code.count('.') == 2:
                    level = 'group'    # Группа (01.11, 01.12...)
                else:
                    level = 'unknown'
                
                # Создаем поисковый текст
                search_text = f"{code} {name}".lower()
                
                data.append({
                    'section': section,
                    'code': code,
                    'name': name,
                    'level': level,
                    'search_text': search_text
                })
                
                processed_count += 1
                
                # Выводим прогресс каждые 100 записей
                if processed_count % 100 == 0:
                    print(f"📊 Обработано записей: {processed_count}")
    
    except Exception as e:
        print(f"❌ Ошибка при обработке файла: {e}")
        print("Советы:")
        print("1. Откройте CSV в Excel и сохраните как CSV UTF-8")
        print("2. Или откройте в Notepad++: Кодировка → Преобразовать в UTF-8")
        print("3. Или попробуйте другую кодировку, изменив список encodings_to_try")
        return
    
    # Сохраняем как JS файл
    try:
        with open(output_file, 'w', encoding='utf-8') as f:
            f.write('// Данные справочника ОКВЭД2\n')
            f.write('// Автоматически сгенерировано из CSV\n')
            f.write('// Источник: classifikators.ru\n\n')
            f.write('const okved2Data = ')
            json.dump(data, f, ensure_ascii=False, indent=2)
            f.write(';')
        
        print(f"\n✅ Конвертация завершена успешно!")
        print(f"   Обработано записей: {processed_count}")
        print(f"   Пропущено строк: {skipped_count}")
        print(f"   Сохранено в: {output_file}")
        
        # Статистика
        print("\n📊 Статистика по уровням:")
        levels_count = {}
        for item in data:
            level = item['level']
            levels_count[level] = levels_count.get(level, 0) + 1
        
        for level, count in sorted(levels_count.items()):
            print(f"   {level}: {count}")
        
        # Примеры
        print("\n📋 Примеры записей (первые 3):")
        for i in range(min(3, len(data))):
            item = data[i]
            print(f"   {item['code']}: {item['name'][:60]}...")
        
        # Проверка целостности
        print("\n🔍 Проверка данных:")
        print(f"   Разделы: {sorted(set(item['section'] for item in data))}")
        
        # Поиск возможных проблем
        unknown_levels = [item for item in data if item['level'] == 'unknown']
        if unknown_levels:
            print(f"   ⚠️  Найдены записи с неизвестным уровнем: {len(unknown_levels)}")
            for item in unknown_levels[:3]:
                print(f"      {item['code']}")
    
    except Exception as e:
        print(f"❌ Ошибка при сохранении файла: {e}")

def main():
    input_file = "okved.csv"
    output_file = "data.js"
    
    print("📁 Поиск файла...")
    
    import os
    if not os.path.exists(input_file):
        print(f"❌ Файл '{input_file}' не найден!")
        print("Доступные файлы:")
        for file in os.listdir('.'):
            if file.endswith('.csv'):
                print(f"  - {file}")
        return
    
    print(f"✅ Файл найден: {input_file} ({os.path.getsize(input_file)} байт)")
    
    convert_okved_csv_to_json(input_file, output_file)
    
    print("\n🎯 Следующие шаги:")
    print("1. Проверьте файл data.js - все тексты должны быть читаемыми")
    print("2. Если есть иероглифы, попробуйте: python -c \"print(open('okved.csv','rb').read()[:200])\"")
    print("3. Для принудительной конвертации используйте Notepad++ или Excel")

if __name__ == "__main__":
    main()