import MealImageUploader from '@/components/MealImageUploader';
import { formatDisplayDate } from '@/utils/DateUtils';
import { getMealTypeName } from '@/utils/mealUtils';
import { MealInfo, MealMenuItem, MealImage } from '@/types'; // ?대?吏 ???異붽?
import StarRating from '@/components/StarRating';
import { useState, useEffect, useCallback } from 'react';
import ImageWithFallback from '@/components/ImageWithFallback';
import { createClient } from '@/lib/supabase';
import { useUser } from '@supabase/auth-helpers-react';
import MyMealRating from '@/components/MyMealRating';
import SchoolRating from './SchoolRating';

// Supabase ?대씪?댁뼵??珥덇린??const supabase = createClient();

// ?붾쾭源낆슜 肄섏넄 濡쒓렇
console.log('MealCard 而댄룷?뚰듃 濡쒕뱶?? Supabase ?대씪?댁뼵??珥덇린??);

interface MealCardProps {
  meal: MealInfo;
  onShowOrigin(info: string): void;
  onShowNutrition(meal: MealInfo): void;
  onUploadSuccess(): void;
  onUploadError(error: string): void;
}

// 蹂꾩젏 吏???쒖떆 而댄룷?뚰듃
function MenuItemWithRating({ item, interactive = true }: { item: MealMenuItem; interactive?: boolean }) {
  // ?곹깭濡??ъ슜??愿由?  const [user, setUser] = useState(null);
  
  // 而댄룷?뚰듃 留덉슫?????ъ슜???뺣낫 媛?몄삤湲?  useEffect(() => {
    // 鍮꾨룞湲곕줈 ?ъ슜???뺣낫 媛?몄삤湲?    const getUser = async () => {
      const { data } = await supabase.auth.getUser();
      console.log('?ㅼ젣 ?ъ슜???뺣낫:', data?.user);
      setUser(data?.user);
    };
    
    getUser();
  }, []);
  
  // ?ㅼ떆媛?援щ룆 ?ㅼ젙: menu_item_rating_stats ?뚯씠釉?蹂寃?媛먯?
  useEffect(() => {
    if (!item || !item.id) return;
    
    console.log('?뵆 menu_item_rating_stats ?뚯씠釉??ㅼ떆媛?援щ룆 ?ㅼ젙 - ?꾩씠??ID:', item.id);
    
    // ?ㅼ떆媛??낅뜲?댄듃瑜??꾪븳 梨꾨꼸 ?앹꽦
    const channel = supabase
      .channel(`menu_item_rating_stats:${item.id}`)
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'menu_item_rating_stats',
          filter: `menu_item_id=eq.${item.id}` 
        }, 
        (payload) => {
          console.log('?봽 ?꾩씠?쒗룊???ㅼ떆媛??낅뜲?댄듃 ?섏떊:', payload);
          // ???곗씠?곕줈 ?곹깭 ?낅뜲?댄듃
          if (payload.new) {
            const newData = payload.new as { avg_rating?: number; rating_count?: number };
            setAvgRating(newData.avg_rating || 0);
            setRatingCount(newData.rating_count || 0);
            console.log('???꾩씠?쒗룊??UI ?낅뜲?댄듃 ?꾨즺:', newData.avg_rating, newData.rating_count);
          }
        }
      )
      .subscribe();
    
    // 而댄룷?뚰듃 ?몃쭏?댄듃 ??援щ룆 ?댁젣
    return () => {
      console.log('?뵆 menu_item_rating_stats ?뚯씠釉?援щ룆 ?댁젣 - ?꾩씠??ID:', item.id);
      supabase.removeChannel(channel);
    };
  }, [item?.id]); // ?꾩씠??ID媛 蹂寃쎈맆 ?뚮쭔 ?ъ떎??  const [rating, setRating] = useState<number | null>(item.user_rating || null);
  const [avgRating, setAvgRating] = useState<number | null>(item.avg_rating || null);
  const [ratingCount, setRatingCount] = useState<number | null>(item.rating_count || null);
  const [isLoading, setIsLoading] = useState(false);
  
  // ?ъ슜??濡쒓렇???곹깭 肄섏넄???쒖떆 (?붾쾭源낆슜)
  useEffect(() => {
    console.log('MenuItemWithRating - ?ъ슜??濡쒓렇???곹깭:', user ? '濡쒓렇?몃맖' : '濡쒓렇???덈맖');
    if (user) console.log('?ъ슜??ID:', user.id); // ?ъ슜??ID ?붾쾭源?濡쒓렇 異붽?
  }, [user]);

  // ?ъ슜??蹂꾩젏 ????⑥닔 - ?⑥닚?붾맂 踰꾩쟾, ???蹂???ㅻ쪟 ?섏젙
  const saveRating = async (menuItemId: string, rating: number) => {
    try {
      // ?ъ슜???몄쬆 ?뺤씤
      if (!user || !user.id) {
        console.error('???ъ슜??濡쒓렇???곹깭媛 ?꾨떃?덈떎');
        alert('蹂꾩젏???④린?ㅻ㈃ 濡쒓렇?명빐二쇱꽭??');
        return false;
      }
      
      if (!menuItemId) {
        console.error('??硫붾돱 ?꾩씠??ID媛 ?놁뒿?덈떎');
        return false;
      }
      
      console.log('?뮶 蹂꾩젏 ????쒕룄:', menuItemId, rating);
      
      // Supabase??蹂꾩젏 ???- UPSERT ?ъ슜
      const { error } = await supabase
        .from('menu_item_ratings')
        .upsert({
          user_id: user.id,
          menu_item_id: menuItemId,
          rating: rating,  // 紐낆떆?곸쑝濡??レ옄 ?꾨떖
          updated_at: new Date().toISOString()
        }, { 
          onConflict: 'user_id,menu_item_id'
        });
      
      if (error) {
        console.error('??????ㅻ쪟:', error.message);
        return false;
      }
      
      console.log('??蹂꾩젏 ????깃났!');
      return true;
    } catch (error) {
      console.error('??蹂꾩젏 ???以??ㅻ쪟:', error);
      return false;
    }
  };

  // ?ъ슜??蹂꾩젏 ??젣 ?⑥닔
  const deleteRating = async (menuItemId: string) => {
    try {
      if (!user || !user.id) {
        console.error('???ъ슜??濡쒓렇???곹깭媛 ?꾨떃?덈떎');
        alert('蹂꾩젏???④린?ㅻ㈃ 濡쒓렇?명빐二쇱꽭??');
        return false;
      }
      if (!menuItemId) {
        console.error('??硫붾돱 ?꾩씠??ID媛 ?놁뒿?덈떎');
        return false;
      }
      console.log('?뿊截?蹂꾩젏 ??젣 ?쒕룄:', menuItemId);
      const { error } = await supabase
        .from('menu_item_ratings')
        .delete()
        .eq('user_id', user.id)
        .eq('menu_item_id', menuItemId);
      if (error) {
        console.error('????젣 ?ㅻ쪟:', error.message);
        return false;
      }
      
      // 硫붾돱 ?꾩씠??蹂꾩젏 ??젣 ??湲됱떇 ?됱젏 ?ш퀎???대깽??諛쒖깮
      console.log('?봽 硫붾돱 ?꾩씠??蹂꾩젏 ??젣 ?깃났, 湲됱떇 ?됱젏 ?ш퀎???꾩슂');
      // ?꾩뿭 ?대깽??諛쒖깮 - 湲됱떇 ?됱젏 ?ш퀎???붿껌
      const event = new CustomEvent('menu-item-rating-change', {
        detail: { menuItemId, deleted: true }
      });
      window.dispatchEvent(event);
      console.log('??蹂꾩젏 ??젣 ?깃났!');
      return true;
    } catch (error) {
      console.error('??蹂꾩젏 ??젣 以??ㅻ쪟:', error);
      return false;
    }
  };

  // 蹂꾩젏 議고쉶 ?⑥닔 - 媛쒖꽑???ㅻ쪟 泥섎━ 諛?濡쒓퉭 異붽?
  const fetchRating = async (menuItemId: string) => {
    try {
      console.log('?∽툘 蹂꾩젏 ?뺣낫 議고쉶 ?쒕룄 - 硫붾돱?꾩씠??ID:', menuItemId);
      
      if (!menuItemId) {
        console.error('硫붾돱?꾩씠??ID媛 ?놁뒿?덈떎.');
        return null;
      }
      
      // 癒쇱? 媛쒕퀎 硫붾돱 ??ぉ???됯퇏 ?됱젏 吏곸젒 怨꾩궛
      const { data: ratingsData, error: ratingsError } = await supabase
        .from('menu_item_ratings')
        .select('rating')
        .eq('menu_item_id', menuItemId);
        
      if (ratingsError) {
        console.error('?됱젏 ?곗씠??議고쉶 ?ㅻ쪟:', ratingsError.message);
        return null;
      }

      // ?됯퇏 諛?媛쒖닔 怨꾩궛
      const ratings = ratingsData || [];
      let avgRating = 0;
      if (ratings.length > 0) {
        // ?뚯닔???섏㎏ ?먮━?먯꽌 諛섏삱由쇳븯??寃곌낵 媛??앹꽦
        const sum = ratings.reduce((sum, item) => sum + item.rating, 0);
        const avg = sum / ratings.length;
        avgRating = Math.round(avg * 10) / 10; // ?뚯닔???섏㎏ ?먮━?먯꽌 諛섏삱由?      }
      const ratingCount = ratings.length;

      console.log('怨꾩궛???듦퀎:', { avgRating, ratingCount });

      // ?ъ슜??蹂꾩젏 議고쉶
      let userRating = null;
      if (user && user.id) {
        // ?꾩옱 ?ъ슜?먯쓽 蹂꾩젏 議고쉶 - single() ???limit(1) ?ъ슜
        const { data: ratingData, error: ratingError } = await supabase
          .from('menu_item_ratings')
          .select('rating')
          .eq('menu_item_id', menuItemId)
          .eq('user_id', user.id)
          .limit(1);

        // ?ㅻ쪟 泥섎━
        if (ratingError) {
          console.error('???ъ슜??蹂꾩젏 議고쉶 ?ㅻ쪟:', ratingError.message);
        } else {
          // 諛곗뿴?먯꽌 泥?踰덉㎏ ??ぉ ?ъ슜 (議댁옱??寃쎌슦)
          if (ratingData && ratingData.length > 0) {
            userRating = ratingData[0].rating;
            console.log('???ъ슜??蹂꾩젏 議고쉶 ?깃났:', userRating);
          } else {
            console.log('?뱄툘 ?ъ슜??蹂꾩젏 湲곕줉 ?놁쓬');
          }
        }
      } else {
        console.log('濡쒓렇?몃릺吏 ?딆븘 ?ъ슜??蹂꾩젏??議고쉶?섏? ?딆뒿?덈떎.');
      }
      
      const result = {
        avg_rating: avgRating,
        rating_count: ratingCount,
        user_rating: userRating
      };
      
      console.log('??理쒖쥌 蹂꾩젏 議고쉶 寃곌낵:', result);
      return result;
    } catch (error) {
      console.error('蹂꾩젏 ?뺣낫 議고쉶 ?ㅻ쪟:', error);
      // ?ㅻ쪟 諛쒖깮??湲곕낯媛?諛섑솚
      return {
        avg_rating: 0,
        rating_count: 0,
        user_rating: null
      };
    }
  };

  // 蹂꾩젏 ?곹깭 珥덇린???⑥닔 - ?⑥닚?붾맂 踰꾩쟾
  const initRatingState = async () => {
    try {
      // ?대? 蹂꾩젏 ?뺣낫媛 ?덉쑝硫??ъ슜
      if (item.user_rating !== undefined) {
        setRating(item.user_rating);
        setAvgRating(item.avg_rating);
        setRatingCount(item.rating_count);
        return;
      }

      // ?쒕쾭?먯꽌 ?곗씠??議고쉶
      const data = await fetchRating(item.id);
      
      if (data) {
        setRating(data.user_rating);
        setAvgRating(data.avg_rating);
        setRatingCount(data.rating_count);
      } else {
        // 議고쉶 ?ㅽ뙣 ??湲곕낯媛??ъ슜
        setRating(null);
        setAvgRating(0);
        setRatingCount(0);
      }
    } catch (error) {
      console.error('蹂꾩젏 ?곗씠??珥덇린??以??ㅻ쪟:', error);
    }
  };

  // 珥덇린 蹂꾩젏 議고쉶 諛??ъ슜???꾩씠??蹂寃????ъ“??  useEffect(() => {
    if (item && item.id) {
      initRatingState();
    }
  }, [item.id, user, item]);

  // 蹂꾩젏 ?대┃ ?대깽??泥섎━ ?⑥닔 - 蹂??щ씪吏?臾몄젣 ?닿껐 + 蹂꾩젏 痍⑥냼(??젣) 吏??  const handleRating = async (value: number) => {
    try {
      // 濡쒓렇???뺤씤
      if (!user) {
        alert('蹂꾩젏???④린?ㅻ㈃ 濡쒓렇?명빐二쇱꽭??');
        return;
      }
      if (!item.id) {
        console.error('硫붾돱 ?꾩씠??ID媛 ?놁뒿?덈떎');
        return;
      }
      console.log('狩?蹂꾩젏 ?좏깮:', value);
      setIsLoading(true);
      const previousRating = rating;

      // ?대? ?좏깮??蹂꾩쓣 ?ㅼ떆 ?대┃?섎㈃ 蹂꾩젏 ??젣
      if (rating === value) {
        setRating(null); // UI?먯꽌 蹂꾩젏 ?쒓굅
        const deleted = await deleteRating(item.id);
        if (deleted) {
        }
        
        console.log('?대┃??蹂꾩젏???대? ??λ맂 蹂꾩젏怨?媛숈쓬, 蹂꾩젏 ??젣 ?쒕룄');
        
        // ?대깽??諛쒖깮 - ?ㅻⅨ 而댄룷?뚰듃??蹂寃??뚮━湲?        const event = new CustomEvent('menu-item-rating-change', {
          detail: { menuItemId: item.id, deleted: true, previousRating }
        });
        window.dispatchEvent(event);
        
        // ?쒕쾭????젣 ?붿껌 ?꾩넚
        const success = await deleteRating(item.id);
        
        if (!success) {
          // ??젣 ?ㅽ뙣???댁쟾 ?곹깭濡??섎룎由ш린
          console.warn('蹂꾩젏 ??젣 ?ㅽ뙣, ?댁쟾 ?곹깭 ?좎?');
          setRating(previousRating);
          // ?꾩뿉??蹂寃쏀븳 ?됯퇏???섎룎?ㅼ빞 ??          await fetchRating(item.id); // ?ㅼ젣 理쒖떊 ?곗씠?곕줈 ?ㅼ떆 ?ъ“??        } else {
          console.log('蹂꾩젏 ??젣 ?깃났, UI ?대? ?낅뜲?댄듃??);
          
          // ?쎄컙??吏?????ㅼ젣 ?곗씠?곕줈 ?낅뜲?댄듃 (理쒖쥌 ?뺤씤)
          setTimeout(async () => {
            await fetchRating(item.id);
          }, 500);
        }
      } else {
        // ?덈줈??蹂꾩젏 ???- ?닿납???숆????낅뜲?댄듃 ?곸슜
        setRating(value);
        
        // ?됯퇏 蹂꾩젏 諛?移댁슫???꾩떆 ?낅뜲?댄듃 (?⑥닚 ?덉긽)
        if (avgRating && ratingCount) {
          const oldSum = avgRating * ratingCount;
          // 泥섏쓬 蹂꾩젏?대㈃ 移댁슫??利앷?, 洹몃젃吏 ?딆쑝硫??댁쟾 蹂꾩젏 諛섏쁺
          const newCount = previousRating === null ? ratingCount + 1 : ratingCount;
          const newSum = previousRating === null ? oldSum + value : oldSum - previousRating + value;
          const newAvg = newSum / newCount;
          setAvgRating(Math.round(newAvg * 10) / 10);
          setRatingCount(newCount);
        } else {
          // 泥섏쓬 蹂꾩젏?대㈃ 諛붾줈 ?ㅼ젙
          setAvgRating(value);
          setRatingCount(1);
        }
        
        console.log('?덈줈??蹂꾩젏 ????쒕룄:', value);
        
        // ?대깽??諛쒖깮 - ?ㅻⅨ 而댄룷?뚰듃??蹂寃??뚮━湲?        const event = new CustomEvent('menu-item-rating-change', {
          detail: { menuItemId: item.id, newRating: value, previousRating }
        });
        window.dispatchEvent(event);
        
        // ?쒕쾭??????붿껌 ?꾩넚
        const success = await saveRating(item.id, value);
        
        if (!success) {
          // ????ㅽ뙣???댁쟾 ?곹깭濡??섎룎由ш린
          console.warn('蹂꾩젏 ????ㅽ뙣, ?댁쟾 ?곹깭濡?蹂듭썝');
          setRating(previousRating);
          // ?꾩뿉??蹂寃쏀븳 ?됯퇏???섎룎?ㅼ빞 ??          await fetchRating(item.id); // ?ㅼ젣 理쒖떊 ?곗씠?곕줈 ?ㅼ떆 ?ъ“??        } else {
          console.log('蹂꾩젏 ????깃났, UI ?대? ?낅뜲?댄듃??);
          
          // ?쎄컙??吏?????ㅼ젣 ?곗씠?곕줈 ?낅뜲?댄듃 (理쒖쥌 ?뺤씤)
          setTimeout(async () => {
            await fetchRating(item.id);
          }, 500);
        }
      }
    } catch (error) {
      console.error('蹂꾩젏 泥섎━ 以??ㅻ쪟:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <li className="flex justify-between items-center py-2 border-b border-gray-100">
      {/* 蹂꾩젏 ?곸뿭 - ?쇱そ?쇰줈 ?대룞 */}
      <div className="flex items-center">
        <div className="rating-container mr-3">
          {/* ?ъ슜???щ?? 愿怨꾩뾾????긽 ?대┃ 媛?ν븯寃?*/}
          {/* 蹂꾪몴 ?ш린 ?ㅼ? */}
          <StarRating 
            value={rating || 0}
            onChange={handleRating}
            interactive={interactive}
            showValue={false}
            size="medium"
          />
        </div>
        <div className="text-gray-700">{item.item_name}</div>
      </div>
      
      {/* ?됯퇏 蹂꾩젏 ?쒖떆 - ?뚯닔??泥⑥㎏?먮━源뚯?留??쒖떆 */}
      {avgRating && ratingCount ? (
        <div className="text-sm text-gray-500">
          {avgRating.toFixed(1)} ({ratingCount}紐?
        </div>
      ) : null}
    </li>
  );
};

// 媛꾨떒????낅퀎 ?꾩씠肄??ы띁 (異뷀썑 ?좏떥濡??대룞 媛??
const getMealTypeIcon = (mealType: string) => {
  switch (mealType) {
    case '議곗떇':
      return '?뜵';
    case '以묒떇':
      return '?뜗';
    case '?앹떇':
      return '?뜴';
    case '媛꾩떇':
      return '?뜧';
    default:
      return '?띂截?;
  }
};

export default function MealCard({
  meal,
  onShowOrigin,
  onShowNutrition,
  onUploadSuccess,
  onUploadError,
}: MealCardProps) {
  // ?대?吏 ?낅줈???깃났 ???몄텧?섎뒗 ?⑥닔 (?⑥닚?붾맖)
  const handleImageChange = useCallback(() => {
    console.log('?뱽 ?대?吏 蹂寃??뚮┝ 諛쏆쓬');
    
    // 理쒖긽??而댄룷?뚰듃??肄쒕갚 ?몄텧 (?덈뒗 寃쎌슦)
    if (onUploadSuccess) {
      onUploadSuccess();
    }
  }, [onUploadSuccess]);
  return (
    <div className="bg-white overflow-hidden">

      {/* 蹂몃Ц */}
      <div className="p-2">

        {/* ?숆탳 蹂꾩젏 */}
        <SchoolRating schoolCode={meal.school_code} mealId={meal.id} className="mb-2" />

        {/* ?대?吏 ?낅줈??*/}
        <MealImageUploader
          key={`uploader-${meal.id}-${meal.meal_date}`} /* ?좎쭨 蹂寃???而댄룷?뚰듃 ?щ쭏?댄듃 */
          mealId={meal.id}
          schoolCode={meal.school_code}
          mealDate={meal.meal_date}
          mealType={meal.meal_type}
          onUploadSuccess={handleImageChange} /* 濡쒖빻 ?몃뱾?щ줈 蹂寃?*/
          onUploadError={onUploadError}
        />

        {/* ?먯궛吏/?곸뼇?뺣낫 踰꾪듉 */}
        <div className="flex justify-between items-center my-2 text-xs">
          <div className="flex items-center gap-2">
            {meal.origin_info && (
              <button
                onClick={() => onShowOrigin(meal.origin_info!)}
                className="text-xs px-1 py-0.5 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
              >
                ?먯궛吏
              </button>
            )}
            {(meal.kcal || meal.ntr_info) && (
              <button
                onClick={() => onShowNutrition(meal)}
                className="text-xs px-1 py-0.5 bg-green-100 text-green-700 rounded hover:bg-green-200 transition-colors"
              >
                ?곸뼇?뺣낫
              </button>
            )}
          </div>
          {meal.kcal && (
            <div className="bg-orange-100 text-orange-800 text-xs px-1.5 py-0.5 rounded">
              {meal.kcal}kcal
            </div>
          )}
        </div>

        {/* ?ㅻ뒛 ?섏쓽 ?됯??? ?뱀뀡 */}
        <div className="mt-3">
          <MyMealRating mealId={meal.id} />
        </div>

        {/* 硫붾돱 紐⑸줉 */}
        <div className="mb-2">
          <ul className="space-y-2">
            {meal.menuItems && meal.menuItems.length > 0 ? (
              // 媛쒕퀎 硫붾돱 ?꾩씠???쒖떆 (?덈줈???곗씠??援ъ“ ?ъ슜 + 蹂꾩젏 湲곕뒫)
              meal.menuItems.map((item) => (
                <MenuItemWithRating
                  key={item.id}
                  item={item}
                  // 湲됱떇?뺣낫媛 ?녿뒗 寃쎌슦 蹂꾩젏 鍮꾪솢?깊솕
                  interactive={Array.isArray(meal.menu_items) && meal.menu_items.length === 1 && meal.menu_items[0] === '湲됱떇 ?뺣낫媛 ?놁뒿?덈떎' ? false : true}
                />
              ))
            ) : (
              // 湲곗〈 menu_items 諛곗뿴 ?ъ슜 (?섏쐞 ?명솚???좎?)
              meal.menu_items.map((item, idx) => (
                <li key={idx} className="text-gray-700">
                  {item}
                </li>
              ))
            )}
          </ul>
        </div>


        {/* 踰꾪듉???곷떒?쇰줈 ?대룞??*/}
      </div>
    </div>
  );
}
